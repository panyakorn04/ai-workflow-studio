import { NextRequest } from "next/server";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const base=process.env.FRONTEND_API_BASE_URL;
 if(!base)return Response.json({ok:false,error:"Backend unavailable"},{status:503});
 const {id}=await params;
 const controller=new AbortController(); request.signal.addEventListener("abort",()=>controller.abort(),{once:true});
 try {
  const upstream=await fetch(`${base.replace(/\/$/,"")}/api/studio/executions/${encodeURIComponent(id)}/events`,{headers:{Accept:"text/event-stream"},cache:"no-store",signal:controller.signal});
  if(!upstream.ok||!upstream.body)return Response.json({ok:false,error:"Execution stream unavailable"},{status:upstream.status||502});
  return new Response(upstream.body,{status:200,headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}});
 } catch { return Response.json({ok:false,error:"Execution stream unavailable"},{status:502}); }
}
