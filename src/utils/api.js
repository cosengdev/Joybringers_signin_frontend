import axios from 'axios'
const MOCK_MODE = true

const mockDB = {
  staff: { 'STV-001': { badgeNumber:'STV-001', firstName:'John', lastName:'Doe', role:'Directors', phone:'08012345678' } },
  admins: { 'ADM-001': { pin:'748291', name:'Admin User' } },
  staffLogs: [
    { id:1, badgeNumber:'STV-001', name:'John Doe', role:'Directors', signIn:new Date(Date.now()-86400000).toISOString(), signOut:new Date(Date.now()-82800000).toISOString() },
    { id:2, badgeNumber:'STV-001', name:'John Doe', role:'Directors', signIn:new Date(Date.now()-172800000).toISOString(), signOut:new Date(Date.now()-169200000).toISOString() },
  ],
  visitorLogs: [],
}

function mockDelay(ms=300){return new Promise(r=>setTimeout(r,ms))}
function mockResponse(data){return{data}}
function mockError(status,message){const err=new Error(message);err.response={status,data:{message}};return Promise.reject(err)}
function getOpenStaff(badge){return[...mockDB.staffLogs].reverse().find(e=>e.badgeNumber===badge&&!e.signOut)||null}
function getOpenVisitor(name,phone){return[...mockDB.visitorLogs].reverse().find(e=>e.name.toLowerCase()===name.toLowerCase()&&e.phone===phone&&!e.signOut)||null}
const recent=new Set()
function isDupe(key){if(recent.has(key))return true;recent.add(key);setTimeout(()=>recent.delete(key),3000);return false}

const mock = {
  lookupStaff: async(badge)=>{await mockDelay();const s=mockDB.staff[badge];if(!s)return mockError(404,'Staff not found');return mockResponse({...s,isSignedInToday:!!getOpenStaff(badge)})},
  registerStaff: async(data)=>{await mockDelay();if(mockDB.staff[data.badgeNumber])return mockError(409,'Badge already registered');mockDB.staff[data.badgeNumber]=data;return mockResponse(data)},
  signIn: async(badge)=>{await mockDelay();if(isDupe(`si-${badge}`))return mockResponse({success:true});const s=mockDB.staff[badge];if(!s)return mockError(404,'Staff not found');mockDB.staffLogs.push({id:Date.now(),badgeNumber:badge,name:`${s.firstName} ${s.lastName}`,role:s.role,signIn:new Date().toISOString(),signOut:null});return mockResponse({success:true})},
  signOut: async(badge,phone)=>{await mockDelay();const s=mockDB.staff[badge];if(!s)return mockError(404,'Staff not found');if(s.phone&&s.phone!==phone)return mockError(401,'Phone number does not match');const e=getOpenStaff(badge);if(e)e.signOut=new Date().toISOString();return mockResponse({success:true})},
  adminLogin: async(badge,pin)=>{await mockDelay();const a=mockDB.admins[badge];if(!pin||pin.length<6)return mockError(401,'PIN must be at least 6 digits');if(!a||a.pin!==pin)return mockError(401,'Invalid badge number or PIN');return mockResponse({token:'mock-'+Date.now(),badgeNumber:badge,name:a.name,role:'Administrator'})},
  visitorSignIn: async(data)=>{await mockDelay();if(isDupe(`vi-${data.phone}`))return mockResponse({success:true});mockDB.visitorLogs.push({id:Date.now(),...data,signIn:new Date().toISOString(),signOut:null});return mockResponse({success:true})},
  visitorSignOut: async(name,phone)=>{await mockDelay();const e=getOpenVisitor(name,phone);if(!e)return mockError(404,'No active session found');e.signOut=new Date().toISOString();return mockResponse({success:true})},
  lookupVisitor: async(name,phone)=>{await mockDelay();return mockResponse({isSignedInToday:!!getOpenVisitor(name,phone)})},
  getStaffLogs: async()=>{await mockDelay(100);return mockResponse([...mockDB.staffLogs].reverse())},
  getVisitorLogs: async()=>{await mockDelay(100);return mockResponse([...mockDB.visitorLogs].reverse())},
}

const api=axios.create({baseURL:'/api',headers:{'Content-Type':'application/json'}})
api.interceptors.request.use(config=>{const s=sessionStorage.getItem('adminSession');if(s){const{token}=JSON.parse(s);if(token)config.headers.Authorization=`Bearer ${token}`};return config})
api.interceptors.response.use(res=>res,err=>{if(err.response?.status===401&&window.location.pathname.includes('dashboard')){sessionStorage.removeItem('adminSession');window.location.href='/admin/login'};return Promise.reject(err)})

export const lookupStaff   =(badge)       =>MOCK_MODE?mock.lookupStaff(badge)        :api.get(`/staff/${badge}`)
export const registerStaff =(data)        =>MOCK_MODE?mock.registerStaff(data)        :api.post('/staff',data)
export const signIn        =(badge)       =>MOCK_MODE?mock.signIn(badge)              :api.post('/attendance/signin',{badgeNumber:badge})
export const signOut       =(badge,phone) =>MOCK_MODE?mock.signOut(badge,phone)       :api.post('/attendance/signout',{badgeNumber:badge,phone})
export const adminLogin    =(badge,pin)   =>MOCK_MODE?mock.adminLogin(badge,pin)      :api.post('/admin/login',{badgeNumber:badge,pin})
export const visitorSignIn =(data)        =>MOCK_MODE?mock.visitorSignIn(data)        :api.post('/visitor/signin',data)
export const visitorSignOut=(name,phone)  =>MOCK_MODE?mock.visitorSignOut(name,phone) :api.post('/visitor/signout',{name,phone})
export const lookupVisitor =(name,phone)  =>MOCK_MODE?mock.lookupVisitor(name,phone)  :api.get(`/visitor/lookup?name=${encodeURIComponent(name)}&phone=${phone}`)
export const getStaffLogs  =()            =>MOCK_MODE?mock.getStaffLogs()             :api.get('/admin/logs/staff')
export const getVisitorLogs=()            =>MOCK_MODE?mock.getVisitorLogs()           :api.get('/admin/logs/visitors')
export default api
