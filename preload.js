const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
  },
  filamentProfiles: {
    list: () => ipcRenderer.invoke('filamentProfiles:list'),
    create: (data) => ipcRenderer.invoke('filamentProfiles:create', data),
    update: (id, patch) => ipcRenderer.invoke('filamentProfiles:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('filamentProfiles:delete', id),
  },
  people: {
    list: () => ipcRenderer.invoke('people:list'),
    update: (id, patch) => ipcRenderer.invoke('people:update', { id, patch }),
  },
  orders: {
    listAll: () => ipcRenderer.invoke('orders:listAll'),
    get: (id) => ipcRenderer.invoke('orders:get', id),
    createForPerson: (payload) => ipcRenderer.invoke('orders:createForPerson', payload),
    update: (id, patch) => ipcRenderer.invoke('orders:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('orders:delete', id),
  },
  plates: {
    listByOrder: (orderId) => ipcRenderer.invoke('plates:listByOrder', orderId),
    pickFile: () => ipcRenderer.invoke('plates:pickFile'),
    previewFile: (sourcePath) => ipcRenderer.invoke('plates:previewFile', sourcePath),
    create: (payload) => ipcRenderer.invoke('plates:create', payload),
    update: (id, patch) => ipcRenderer.invoke('plates:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('plates:delete', id),
    reorder: (orderedIds) => ipcRenderer.invoke('plates:reorder', orderedIds),
    reveal: (storedFileName) => ipcRenderer.invoke('plates:reveal', storedFileName),
  },
  queue: {
    list: () => ipcRenderer.invoke('queue:list'),
    stats: () => ipcRenderer.invoke('queue:stats'),
  },
  slicer: {
    send: (plateId) => ipcRenderer.invoke('slicer:send', plateId),
  },
  slicers: {
    detect: () => ipcRenderer.invoke('slicers:detect'),
    browse: () => ipcRenderer.invoke('slicers:browse'),
  },
});
