// Home route loading shim. Renders the brand-dark background ONLY —
// no skeleton, no shimmer, no animated placeholders. The earlier
// versions flashed a busy skeleton for 3-4 seconds before the
// HomeTour content swapped in, which read as a broken first-paint.
//
// Now the user sees a solid background for the bridge period (which
// matches the body background already), so the visual transition is
// "background → HomeTour content" instead of "skeleton → content".

export default function HomeLoading() {
  return <div style={{ minHeight: "100dvh", background: "#07100a" }} />;
}
