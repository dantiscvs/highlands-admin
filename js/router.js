// Minimal hash router. Routes: #/trips, #/trips/:id/:section, #/invite/:token, #/account
function parseRoute() {
  const h = (location.hash || '#/trips').slice(2);
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'invite' && parts[1]) {
    return { view: 'invite', token: parts[1] };
  }
  if (parts[0] === 'account') {
    return { view: 'account' };
  }
  if (parts[0] === 'trips' && parts[1]) {
    return { view: 'trip', tripId: parts[1], section: parts[2] || 'overview' };
  }
  return { view: 'trips' };
}

function goTrips() { location.hash = '#/trips'; }
function goTrip(id, section) { location.hash = `#/trips/${id}/${section || 'overview'}`; }
function goAccount() { location.hash = '#/account'; }

window.addEventListener('hashchange', () => onSignedIn());

async function onSignedIn() {
  if (!currentUser) return;
  // A magic-link sign-in is a full page redirect that can't preserve the
  // #/invite/:token hash (Supabase's emailRedirectTo has no hash), so we
  // stash the token before sending the link (see auth.js) and pick it back
  // up here once the user is actually signed in.
  const pendingToken = localStorage.getItem('pendingInviteToken');
  if (pendingToken) {
    localStorage.removeItem('pendingInviteToken');
    await redeemInviteToken(pendingToken);
    return;
  }
  const route = parseRoute();
  if (route.view === 'invite') {
    await redeemInviteToken(route.token);
  } else if (route.view === 'account') {
    renderSidebarTripsList();
    await renderAccountPage();
  } else if (route.view === 'trips') {
    renderSidebarTripsList();
    await renderTripsListPage();
  } else {
    await renderTripShell(route.tripId, route.section);
  }
}
