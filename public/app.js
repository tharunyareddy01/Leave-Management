const $ = id => document.getElementById(id);
let currentUser = null, allRequests = [], activeFilter = "All", selectedRequest = null;
const initials = name => (name || "").split(" ").map(x => x[0]).slice(0,2).join("").toUpperCase();
const dateFmt = d => d ? new Date(`${String(d).slice(0,10)}T00:00:00`).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const isManager = () => currentUser && ["manager","admin"].includes(currentUser.role);
async function api(url, options={}) {
  const res = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600);}
function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $(`${name}Page`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  $("crumb").textContent=({overview:"Overview",apply:"Apply for leave",requests:"Leave requests",people:"People directory"})[name];
  if(name==="requests") loadRequests();
  if(name==="people"){loadPeople();if(currentUser.role==="admin")loadPendingAccounts();}
  if(name==="overview") loadDashboard();
  window.scrollTo(0,0);
}
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]"); if(go) showPage(go.dataset.go);
  const nav=e.target.closest("[data-page]"); if(nav) showPage(nav.dataset.page);
});
async function boot(){
  try{
    const data=await api("/api/me");
    if(data.user){currentUser=data.user;showApp();}
  }catch(e){}
}
function showApp(){
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("userName").textContent=currentUser.name;$("userRole").textContent=currentUser.role;
  $("userInitials").textContent=initials(currentUser.name);$("topInitials").textContent=initials(currentUser.name);
  $("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  document.querySelectorAll(".manager-only").forEach(el=>el.classList.toggle("hidden",!isManager()));
  $("welcomeTitle").textContent=currentUser.role==="employee"?"A little space to breathe.":"Good things happen when people feel supported.";
  $("welcomeSub").textContent=currentUser.role==="employee"?"Here’s what’s happening with your time away.":"Here’s the latest across your people workspace.";
  showPage("overview");loadLeaveTypes();
}
function showAuthForm(mode){
  const signup=mode==="signup";
  $("loginForm").classList.toggle("hidden",signup);
  $("signupForm").classList.toggle("hidden",!signup);
  $("demoBox").classList.toggle("hidden",signup);
  $("showSignup").classList.toggle("hidden",signup);
  $("loginError").textContent="";$("signupMessage").textContent="";
}
$("showSignup").addEventListener("click",()=>showAuthForm("signup"));
$("showLogin").addEventListener("click",()=>showAuthForm("login"));
$("signupForm").addEventListener("submit",async e=>{
  e.preventDefault();$("signupMessage").textContent="";
  try{
    const result=await api("/api/signup",{method:"POST",body:JSON.stringify({
      name:$("signupName").value,email:$("signupEmail").value,
      department:$("signupDepartment").value,designation:$("signupDesignation").value,
      password:$("signupPassword").value,confirmPassword:$("signupConfirm").value
    })});
    $("signupForm").reset();
    showAuthForm("login");
    $("loginError").textContent=result.message;
    $("loginError").classList.add("success-message");
  }catch(err){$("signupMessage").textContent=err.message;}
});
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginError").textContent="";$("loginError").classList.remove("success-message");
  try{const data=await api("/api/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});currentUser=data.user;showApp();}
  catch(err){$("loginError").textContent=err.message;}
});
document.querySelectorAll("[data-demo]").forEach(btn=>btn.addEventListener("click",()=>{
  const role=btn.dataset.demo;
  $("email").value=`${role}@leaveloom.demo`;
  $("password").value=role==="admin"?"Admin@123":role==="manager"?"Manager@123":"Employee@123";
}));
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});}catch(e){}currentUser=null;$("appView").classList.add("hidden");$("loginView").classList.remove("hidden");});
async function loadLeaveTypes(){
  try{const rows=await api("/api/leave-types");$("leaveType").innerHTML='<option value="">Choose a leave type</option>'+rows.map(t=>`<option value="${t.leave_type_id}">${t.type_name} · up to ${t.max_days} days</option>`).join("");}
  catch(e){toast(e.message);}
}
async function loadDashboard(){
  try{
    const d=await api("/api/dashboard");
    const total=d.counts.reduce((a,x)=>a+Number(x.total),0);
    const count=s=>Number(d.counts.find(x=>x.status===s)?.total||0);
    $("statTotal").textContent=total;$("statPending").textContent=count("Pending");$("statApproved").textContent=count("Approved");$("statPeople").textContent=d.totalEmployees;
    $("pendingBadge").textContent=d.pending;
    $("recentList").innerHTML=d.recent.length?d.recent.map(r=>`<div class="recent-item"><div class="request-avatar">${initials(r.employee_name)}</div><div class="recent-info"><b>${escapeHtml(r.employee_name)} · ${escapeHtml(r.type_name)}</b><small>${dateFmt(r.from_date)} – ${dateFmt(r.to_date)}</small></div><span class="status ${r.status}">${r.status}</span></div>`).join(""):'<div class="empty-state"><p>No leave requests yet. A fresh start.</p></div>';
  }catch(e){toast(e.message);}
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("leaveForm").addEventListener("submit",async e=>{
  e.preventDefault();$("formMessage").textContent="";
  try{
    const result=await api("/api/requests",{method:"POST",body:JSON.stringify({leave_type_id:$("leaveType").value,from_date:$("fromDate").value,to_date:$("toDate").value,reason:$("reason").value})});
    $("formMessage").textContent=result.message;$("leaveForm").reset();toast(result.message);loadDashboard();
  }catch(err){$("formMessage").textContent=err.message;}
});
async function loadRequests(){
  try{allRequests=await api("/api/requests");renderRequests();$("pendingBadge").textContent=allRequests.filter(r=>r.status==="Pending").length;}
  catch(e){toast(e.message);}
}
function renderRequests(){
  const q=$("requestSearch").value.toLowerCase();
  const rows=allRequests.filter(r=>(activeFilter==="All"||r.status===activeFilter)&&[r.employee_name,r.type_name,r.reason,r.department].join(" ").toLowerCase().includes(q));
  $("requestRows").innerHTML=rows.map(r=>`<tr>
    <td><div class="person-cell"><span class="request-avatar">${initials(r.employee_name)}</span><div><b>${escapeHtml(r.employee_name)}</b><small>${escapeHtml(r.department)}</small></div></div></td>
    <td>${escapeHtml(r.type_name)}</td><td>${dateFmt(r.from_date)}<br><small>to ${dateFmt(r.to_date)}</small></td>
    <td><span class="status ${r.status}">${r.status}</span></td><td title="${escapeHtml(r.reason)}">${escapeHtml(r.reason).slice(0,38)}${r.reason.length>38?"…":""}</td>
    ${isManager()?`<td>${r.status==="Pending"?`<button class="action-btn" data-review="${r.request_id}">Review</button>`:"—"}</td>`:""}
  </tr>`).join("");
  $("emptyRequests").classList.toggle("hidden",rows.length>0);
}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderRequests();}));
$("requestSearch").addEventListener("input",renderRequests);
document.addEventListener("click",e=>{
  const review=e.target.closest("[data-review]");
  if(review){selectedRequest=review.dataset.review;$("decisionTitle").textContent="Review leave request";$("managerComment").value="";$("decisionModal").classList.remove("hidden");}
});
$("closeModal").addEventListener("click",()=>$("decisionModal").classList.add("hidden"));
async function decide(status){
  try{const result=await api(`/api/requests/${selectedRequest}/status`,{method:"PATCH",body:JSON.stringify({status,manager_comment:$("managerComment").value})});$("decisionModal").classList.add("hidden");toast(result.message);loadRequests();loadDashboard();}
  catch(e){toast(e.message);}
}
$("approveBtn").addEventListener("click",()=>decide("Approved"));$("rejectBtn").addEventListener("click",()=>decide("Rejected"));
async function loadPendingAccounts(){
  try{
    const rows=await api("/api/pending-accounts");
    $("pendingAccountsPanel").classList.remove("hidden");
    $("pendingAccountsList").innerHTML=rows.length?rows.map(a=>`
      <div class="pending-account">
        <div><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.email)} · ${escapeHtml(a.department)} · ${escapeHtml(a.designation)}</small></div>
        <div class="pending-actions"><button class="action-btn" data-account="${a.employee_id}" data-status="Approved">Approve</button><button class="action-btn decline" data-account="${a.employee_id}" data-status="Rejected">Reject</button></div>
      </div>`).join(""):'<p class="no-pending">No accounts waiting for approval.</p>';
  }catch(e){toast(e.message);}
}
document.addEventListener("click",async e=>{
  const action=e.target.closest("[data-account]");
  if(!action)return;
  action.disabled=true;
  try{
    const result=await api(`/api/accounts/${action.dataset.account}/status`,{method:"PATCH",body:JSON.stringify({status:action.dataset.status})});
    toast(result.message);loadPendingAccounts();
  }catch(err){toast(err.message);action.disabled=false;}
});
async function loadPeople(){
  try{const people=await api("/api/employees");$("peopleGrid").innerHTML=people.map(p=>`<article class="person-card"><div class="avatar">${initials(p.name)}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.designation)} · ${escapeHtml(p.department)}</p><span>${escapeHtml(p.role)}</span></article>`).join("");}
  catch(e){toast(e.message);}
}
boot();
