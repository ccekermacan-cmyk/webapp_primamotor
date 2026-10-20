import { useEffect, useState, type ReactNode } from 'react';
import { pb } from '../services/pocketbase/client';

type Check = { collection: string; id: string; token: string; done: (allowed: boolean) => void };
let pending: Check[] = [];
let scheduled = false;
function check(collection: string, id: string, done: Check['done']) {
  pending.push({collection,id,token:pb.authStore.token,done});
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const requests = pending.splice(0);
    for (let i = 0; i < requests.length; i += 200) {
      const chunk = requests.slice(i,i+200);
      void pb.send<{results:Array<{collection:string;id:string;allowed:boolean}>}>('/api/permissions/delete', {
        method:'POST',body:{records:chunk.map(({collection,id})=>({collection,id}))},requestKey:null,
      }).then(data => {
        for (const item of chunk) item.done(item.token === pb.authStore.token && data.results.some(r=>r.collection===item.collection && r.id===item.id && r.allowed===true));
      }).catch(()=>chunk.forEach(item=>item.done(false)));
    }
  });
}
export default function DeleteAccess({collection,id,children}:{collection:string;id:string;children:ReactNode}) {
  const [permission,setPermission]=useState('');
  const [token,setToken]=useState(pb.authStore.token);
  const key=`${token}:${collection}:${id}`;
  useEffect(()=>pb.authStore.onChange(value=>setToken(value)),[]);
  useEffect(()=>{
    let active=true, generation=0;
    const refresh=()=>{const current=++generation;setPermission('');if(id && pb.authStore.isValid) check(collection,id,allowed=>{if(active && generation===current)setPermission(allowed?key:'');});};
    refresh();
    window.addEventListener('focus',refresh);
    window.addEventListener('prima:atomic-change',refresh);
    return ()=>{active=false;window.removeEventListener('focus',refresh);window.removeEventListener('prima:atomic-change',refresh);};
  },[collection,id,key]);
  return permission===key ? <>{children}</> : null;
}
