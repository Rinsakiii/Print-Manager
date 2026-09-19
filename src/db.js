const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fileLibrary = require('./fileLibrary');

let dbPath = null;
let data = null;

function defaultData() {
  return {
    settings: {
      hourlyRate: 2,
      minimumOrderPrice: 5,
      currency: 'USD',
      slicerPath: null,
      slicerName: null,
      onboardingComplete: false,
    },
    filamentProfiles: [],
    people: [],
    orders: [],
    plates: [],
  };
}

function init(userDataDir) {
  dbPath = path.join(userDataDir, 'db.json');
  const isExistingInstall = fs.existsSync(dbPath);
  if (isExistingInstall) {
    try {
      data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (err) {
      console.error('Failed to read db.json, starting fresh:', err);
      data = defaultData();
    }
  } else {
    data = defaultData();
  }

  const defaults = defaultData();
  const hadOnboardingField = !!(data.settings && Object.prototype.hasOwnProperty.call(data.settings, 'onboardingComplete'));
  data.settings = { ...defaults.settings, ...data.settings };
  data.filamentProfiles ??= [];
  data.people ??= [];
  data.orders ??= [];
  data.plates ??= [];

  // Migrate the old single-purpose "bambuStudioPath" field into the
  // generic slicer selection, and don't force pre-existing installs
  // through onboarding just because the field is new.
  if (data.settings.bambuStudioPath) {
    data.settings.slicerPath = data.settings.slicerPath || data.settings.bambuStudioPath;
    data.settings.slicerName = data.settings.slicerName || 'Custom';
  }
  delete data.settings.bambuStudioPath;
  if (isExistingInstall && !hadOnboardingField) {
    data.settings.onboardingComplete = true;
  }
  data.plates.forEach((p) => {
    if (p.status === 'Sent to Bambu Studio') p.status = 'Sent to Slicer';
  });

  if (data.filamentProfiles.length === 0) {
    data.filamentProfiles.push({
      id: uid(),
      name: 'Generic PLA',
      costPerGram: 0.02,
      createdAt: new Date().toISOString(),
    });
  }
  save();
}

function save() {
  // Keep one rotating backup of whatever was on disk before this write, so a
  // bad save (bug, crash mid-write, two instances racing) is recoverable
  // from db.json.bak rather than silently destroying real data.
  if (fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(dbPath, `${dbPath}.bak`);
    } catch (err) {
      console.error('Failed to write db.json.bak:', err);
    }
  }
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dbPath);
}

function uid() {
  return crypto.randomUUID();
}

// ---------- cost helpers ----------

function plateCost(plate) {
  if (plate.manualCostOverride != null) return plate.manualCostOverride;
  const profile = data.filamentProfiles.find((p) => p.id === plate.filamentProfileId);
  const costPerGram = profile ? profile.costPerGram : 0;
  const material = (plate.filamentGrams || 0) * costPerGram;
  const time = ((plate.printTimeMinutes || 0) / 60) * (data.settings.hourlyRate || 0);
  return material + time;
}

function orderSubtotal(orderId) {
  return data.plates.filter((p) => p.orderId === orderId).reduce((sum, p) => sum + plateCost(p), 0);
}

function orderTotal(orderId) {
  const plateCount = data.plates.filter((p) => p.orderId === orderId).length;
  if (plateCount === 0) return 0;
  return Math.max(orderSubtotal(orderId), data.settings.minimumOrderPrice || 0);
}

function orderDisplayName(order) {
  const d = new Date(order.createdAt);
  return `Order – ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

// ---------- settings ----------

function getSettings() {
  return data.settings;
}
function updateSettings(patch) {
  data.settings = { ...data.settings, ...patch };
  save();
  return data.settings;
}

// ---------- filament profiles ----------

function listFilamentProfiles() {
  return [...data.filamentProfiles].sort((a, b) => a.name.localeCompare(b.name));
}
function createFilamentProfile({ name, costPerGram }) {
  const profile = { id: uid(), name: name || 'New Filament', costPerGram: costPerGram || 0, createdAt: new Date().toISOString() };
  data.filamentProfiles.push(profile);
  save();
  return profile;
}
function updateFilamentProfile(id, patch) {
  const profile = data.filamentProfiles.find((p) => p.id === id);
  if (!profile) throw new Error('Filament profile not found');
  Object.assign(profile, patch);
  save();
  return profile;
}
function deleteFilamentProfile(id) {
  data.filamentProfiles = data.filamentProfiles.filter((p) => p.id !== id);
  save();
}

// ---------- people ----------
// People aren't managed as their own top-level entity in the UI — they're
// created/reused implicitly when an order is created, and cleaned up
// automatically when their last order is deleted (see deleteOrder).

function listPeople() {
  return [...data.people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const orders = data.orders.filter((o) => o.personId === p.id);
      const lifetimeTotal = orders.reduce((sum, o) => sum + orderTotal(o.id), 0);
      return { ...p, orderCount: orders.length, lifetimeTotal };
    });
}
function updatePerson(id, patch) {
  const person = data.people.find((p) => p.id === id);
  if (!person) throw new Error('Person not found');
  Object.assign(person, patch);
  save();
  return person;
}
function findOrCreatePerson({ name, contactInfo }) {
  const trimmedName = (name || '').trim();
  let person = data.people.find((p) => p.name.toLowerCase() === trimmedName.toLowerCase());
  if (person) {
    if (contactInfo && !person.contactInfo) {
      person.contactInfo = contactInfo;
      save();
    }
  } else {
    person = { id: uid(), name: trimmedName, contactInfo: contactInfo || '', createdAt: new Date().toISOString() };
    data.people.push(person);
    save();
  }
  return person;
}

// ---------- orders ----------

function decorateOrder(order) {
  const plateCount = data.plates.filter((p) => p.orderId === order.id).length;
  const person = data.people.find((p) => p.id === order.personId) || null;
  return {
    ...order,
    plateCount,
    subtotal: orderSubtotal(order.id),
    total: orderTotal(order.id),
    displayName: orderDisplayName(order),
    personName: person ? person.name : null,
    personContactInfo: person ? person.contactInfo : '',
  };
}
function listAllOrders() {
  return data.orders.map(decorateOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function getOrder(id) {
  const order = data.orders.find((o) => o.id === id);
  return order ? decorateOrder(order) : null;
}
function createOrder(personId) {
  const order = { id: uid(), personId, status: 'New', notes: '', createdAt: new Date().toISOString() };
  data.orders.push(order);
  save();
  return decorateOrder(order);
}
function createOrderForPerson({ name, contactInfo }) {
  const person = findOrCreatePerson({ name, contactInfo });
  return createOrder(person.id);
}
function updateOrder(id, patch) {
  const order = data.orders.find((o) => o.id === id);
  if (!order) throw new Error('Order not found');
  Object.assign(order, patch);
  save();
  return decorateOrder(order);
}
function deleteOrder(id) {
  const order = data.orders.find((o) => o.id === id);
  const removedPlates = data.plates.filter((p) => p.orderId === id);
  data.plates = data.plates.filter((p) => p.orderId !== id);
  data.orders = data.orders.filter((o) => o.id !== id);
  if (order) {
    const remainingForPerson = data.orders.filter((o) => o.personId === order.personId).length;
    if (remainingForPerson === 0) {
      data.people = data.people.filter((p) => p.id !== order.personId);
    }
  }
  save();
  return removedPlates;
}

// ---------- plates ----------

function decoratePlate(plate) {
  const order = data.orders.find((o) => o.id === plate.orderId);
  const person = order ? data.people.find((p) => p.id === order.personId) : null;
  const profile = data.filamentProfiles.find((p) => p.id === plate.filamentProfileId) || null;
  return {
    ...plate,
    cost: plateCost(plate),
    filamentProfile: profile,
    orderLabel: order ? orderDisplayName(order) : null,
    personName: person ? person.name : null,
    thumbnailDataUrl: fileLibrary.getThumbnailDataUrl(plate.storedFileName),
  };
}

function getPlate(id) {
  const plate = data.plates.find((p) => p.id === id);
  return plate ? decoratePlate(plate) : null;
}

function listPlatesByOrder(orderId) {
  return data.plates
    .filter((p) => p.orderId === orderId)
    .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
    .map(decoratePlate);
}

function nextQueuePosition() {
  return data.plates.reduce((max, p) => Math.max(max, p.queuePosition ?? -1), -1) + 1;
}

function createPlate(orderId, input) {
  const plate = {
    id: uid(),
    orderId,
    fileName: input.fileName,
    storedFileName: input.storedFileName,
    filamentProfileId: input.filamentProfileId || null,
    filamentGrams: input.filamentGrams || 0,
    printTimeMinutes: input.printTimeMinutes || 0,
    manualCostOverride: input.manualCostOverride ?? null,
    status: 'Queued',
    queuePosition: nextQueuePosition(),
    addedAt: new Date().toISOString(),
    sentAt: null,
    completedAt: null,
    notes: input.notes || '',
  };
  data.plates.push(plate);
  save();
  return decoratePlate(plate);
}

function updatePlate(id, patch) {
  const plate = data.plates.find((p) => p.id === id);
  if (!plate) throw new Error('Plate not found');
  if (patch.status === 'Done' && plate.status !== 'Done') {
    patch.completedAt = new Date().toISOString();
  } else if (patch.status && patch.status !== 'Done') {
    patch.completedAt = null;
  }
  Object.assign(plate, patch);
  save();
  return decoratePlate(plate);
}

function deletePlate(id) {
  const plate = data.plates.find((p) => p.id === id);
  data.plates = data.plates.filter((p) => p.id !== id);
  save();
  return plate;
}

function reorderQueue(orderedIds) {
  orderedIds.forEach((id, index) => {
    const plate = data.plates.find((p) => p.id === id);
    if (plate) plate.queuePosition = index;
  });
  save();
}

function listQueue() {
  const queued = data.plates
    .filter((p) => p.status === 'Queued')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map(decoratePlate);
  const inProgress = data.plates
    .filter((p) => p.status === 'Sent to Slicer')
    .sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0))
    .map(decoratePlate);
  return { queued, inProgress };
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function getQueueStats() {
  const queuedCount = data.plates.filter((p) => p.status === 'Queued').length;
  const inProgressCount = data.plates.filter((p) => p.status === 'Sent to Slicer').length;
  const doneToday = data.plates.filter((p) => p.status === 'Done' && isToday(p.completedAt));
  const revenueToday = doneToday.reduce((sum, p) => sum + plateCost(p), 0);
  return {
    queuedCount,
    inProgressCount,
    doneTodayCount: doneToday.length,
    revenueToday,
  };
}

module.exports = {
  init,
  getSettings,
  updateSettings,
  listFilamentProfiles,
  createFilamentProfile,
  updateFilamentProfile,
  deleteFilamentProfile,
  listPeople,
  updatePerson,
  listAllOrders,
  getOrder,
  createOrder,
  createOrderForPerson,
  updateOrder,
  deleteOrder,
  listPlatesByOrder,
  getPlate,
  createPlate,
  updatePlate,
  deletePlate,
  reorderQueue,
  listQueue,
  getQueueStats,
};
