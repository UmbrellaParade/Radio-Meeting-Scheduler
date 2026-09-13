(() => {
  const frames = [...document.querySelectorAll('iframe[data-ums-src]')];
  const params = new URLSearchParams(window.location.search);
  frames.forEach((frame) => {
    const source = new URL(frame.dataset.umsSrc, window.location.href);
    source.searchParams.set('embed', 'wordpress');
    source.searchParams.set('initialMode', frame.dataset.umsDefaultMode === 'radio' ? 'radio' : 'band');
    const eventId = params.get('e');
    if (eventId && /^[a-zA-Z0-9_-]{1,128}$/.test(eventId)) {
      source.searchParams.set('e', eventId);
      if (params.get('mode') === 'band') source.searchParams.set('mode', 'band');
    }
    frame.src = source.href;
  });

  window.addEventListener('message', (event) => {
    if (event.data?.type !== 'umbrella-scheduler:resize' || !Number.isFinite(event.data.height)) return;
    const frame = frames.find((item) => item.contentWindow === event.source && new URL(item.src).origin === event.origin);
    if (!frame) return;
    frame.style.height = `${Math.max(320, Math.min(50000, Math.ceil(event.data.height)))}px`;
  });
})();
