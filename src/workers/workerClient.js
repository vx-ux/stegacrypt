import StegoWorker from './stegoWorker?worker';

// Singleton worker instance
let workerInstance = null;
let callbackQueue = {};
let messageIdCounter = 0;

function getWorker() {
  if (!workerInstance) {
    workerInstance = new StegoWorker();
    workerInstance.onmessage = (e) => {
      const { id, status, result, error } = e.data;
      if (callbackQueue[id]) {
        if (status === 'success') {
          callbackQueue[id].resolve(result);
        } else {
          callbackQueue[id].reject(new Error(error));
        }
        delete callbackQueue[id];
      }
    };
  }
  return workerInstance;
}


export function runWorkerTask(type, payload, transfer = []) {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const id = messageIdCounter++;
    callbackQueue[id] = { resolve, reject };
    worker.postMessage({ id, type, payload }, transfer);
  });
}
