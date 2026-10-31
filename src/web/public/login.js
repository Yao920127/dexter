const reason = new URLSearchParams(location.search).get('error');
if (reason === 'denied' || reason === 'failed') document.getElementById(`err-${reason}`).hidden = false;
