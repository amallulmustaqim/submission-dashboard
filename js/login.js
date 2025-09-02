document.addEventListener('DOMContentLoaded', ()=>{
  // Hide counts on login page but keep nav functional
  DTRC.guardAuth({}); // if already logged in, fine

  const btn = DTRC.$('#loginBtn');
  if(!btn) return;

  btn.onclick = ()=>{
    const email=(DTRC.$('#loginEmail').value||'').trim();
    const pass=DTRC.$('#loginPass').value||'';
    const wantSec = DTRC.$('#loginAsSec').checked;
    if(!email||!email.includes('@')) return alert('Enter a valid email');
    if(pass!=='1234') return alert('Invalid password (use 1234)');
    const admins=DTRC.getAdmins(); const roles=DTRC.getRoles();
    const isAdmin=admins.includes(email.toLowerCase()); const secRole=roles[email.toLowerCase()]; const isSecretariat=!!secRole||isAdmin;
    if(wantSec && !isSecretariat){ alert('You are not permitted for Secretariat console.'); return; }
    DTRC.setUser({email,isAdmin,isSecretariat,secRole: secRole||(isAdmin?'edit':null)});
    location.href = wantSec? 'secretariat.html' : 'pm.html';
  };
});
