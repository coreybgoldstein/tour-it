// Session-scoped mute state. Resets on page reload. Not persisted to localStorage or DB.
let _muted = true;

export const sessionMute = {
  get: () => _muted,
  set: (v: boolean) => { _muted = v; },
  toggle: () => { _muted = !_muted; return _muted; },
};
