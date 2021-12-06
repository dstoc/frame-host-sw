const sw = navigator.serviceWorker.register('sw.js');
const framed = !!window.parent;

async function enableDelegation(origin) {
  const notification = new Notification(`Click to allow delegation`, {
    body: `From ${origin}`,
  });
  await new Promise(resolve => {
    notification.addEventListener('click', resolve, {once: true});
  });
  notification.close();
  document.body.textContent = 'Ready.';

  const requests = {};
  navigator.serviceWorker.addEventListener('message', async e => {
    if (!e.data.get) return;
    window.parent.postMessage(e.data, '*', [e.data.port]);
  });
}

if (Notification.permission == 'granted') {
  document.body.textContent = 'Waiting for user permission.';
  addEventListener('message', e => enableDelegation(e.origin), {
    once: true,
  });
} else if (Notification.permission == 'default') {
  document.body.textContent = 'Click to enable.';
  addEventListener('click', async e => {
    document.textContent = 'Waiting for notification permission.';
    await Notification.requestPermission();
    location.reload();
  }, {
    once: true,
  });
} else {
  document.body.textContent = 'Notification permission denied.';
}
