// Minimal hash router. Routes: #/trips, #/trips/:id/:section
function parseRoute() {
  const h = (location.hash || '#/trips').slice(2);
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'trips' && parts[1]) {
    return { view: 'trip', tripId: parts[1], section: parts[2] || 'overview' };
  }
  return { view: 'trips' };
}

function goTrips() { location.hash = '#/trips'; }
function goTrip(id, section) { location.hash = `#/trips/${id}/${section || 'overview'}`; }

window.addEventListener('hashchange', () => onSignedIn());

async function onSignedIn() {
  if (!currentUser) return;
  const route = parseRoute();
  if (route.view === 'trips') {
    renderSidebarTripsList();
    await renderTripsListPage();
  } else {
    await renderTripShell(route.tripId, route.section);
  }
}
