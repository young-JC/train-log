(function (root) {
  'use strict';
  let database;
  function open() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('train2-mobile-recorder', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', {keyPath: 'date'});
      request.onerror = () => reject(request.error || new Error('无法打开本地存储'));
      request.onblocked = () => reject(new Error('存储升级受阻，请关闭其他记录器窗口再打开'));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
    });
    database.catch(() => { database = null; });
    return database;
  }
  async function transaction(mode, callback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('本地保存未完成'));
      const request = callback(tx.objectStore('drafts'));
      request.onsuccess = () => { result = request.result; };
    });
  }
  root.RecorderStorage = {
    open,
    all: () => transaction('readonly', store => store.getAll()),
    put: session => transaction('readwrite', store => store.put(session)),
    async putMany(sessions) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('备份恢复失败'));
        sessions.forEach(session => tx.objectStore('drafts').put(session));
      });
    }
  };
})(globalThis);
