// Cloudflare Pages forwards all requests to the independent Online Worker.
export default {async fetch(request,env){
 if(!env.WARLIKE_ONLINE)return new Response('WarLike Online est en cours de configuration.',{status:503,headers:{'Cache-Control':'no-store'}});
 return env.WARLIKE_ONLINE.fetch(request);
}};
