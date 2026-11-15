import original from './base.js';
import theme from './theme.js';

// Presentation-only streaming transform. APIs, assets, cookies and security
// policies remain owned by the deployed application.
export default {
 async fetch(request,env,ctx){
  const response=await original.fetch(request,env,ctx);
  if(request.method==='HEAD'||response.status!==200||!response.headers.get('content-type')?.toLowerCase().includes('text/html'))return response;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');headers.set('cache-control','no-store');
  return new HTMLRewriter()
   .on('html',{element(e){e.setAttribute('data-warlike-app',theme.app)}})
   .on('meta[name="theme-color"]',{element(e){e.setAttribute('content','#17211B')}})
   .on('link[rel="stylesheet"]',{element(e){if(/warlike-(?:foundation|shell)\.css/.test(e.getAttribute('href')||''))e.remove()}})
   .on('head',{element(e){e.append('<style data-warlike-theme-version="1.1.4">'+theme.css+'</style>',{html:true})}})
   .transform(new Response(response.body,{status:response.status,statusText:response.statusText,headers}));
 }
};
