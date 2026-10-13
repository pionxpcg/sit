/* Shared validation for live-assistant video drafts. No network or wallet operations. */
(function (scope) {
 'use strict';
 const options = Object.freeze({
  source:['uploaded_image','latest_render','video_image'],
  quality:['premium','fast'], duration:[4,6,8], aspect_ratio:['16:9','9:16'],
  workflow:['image','walkthrough','flythrough','cinematic'],
  camera:['push','orbit','pan','dolly','walkthrough'], lighting:['source','day','golden','night']
 });
 const defaults={source:'uploaded_image',quality:'premium',duration:8,aspect_ratio:'16:9',workflow:'image',camera:'push',lighting:'source'};
 const cameras={push:'Slow cinematic push',orbit:'Orbit',pan:'Pan left to right',dolly:'Dolly forward',walkthrough:'Walkthrough'};
 const lights={source:'Lock source lighting',day:'Daylight',golden:'Golden hour',night:'Night'};
 function normalizeVideoRequest(args) {
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>k!=='instruction'&&!Object.hasOwn(options,k)))throw Error('Unsupported video settings.');
  if(typeof args.instruction!=='string'||!args.instruction.trim()||args.instruction.length>1000)throw Error('Describe the video in at most 1000 characters.');
  const result={instruction:args.instruction.trim()};
  for(const [key,values] of Object.entries(options)) {
   const value=args[key]===undefined?defaults[key]:args[key];
   if(!values.includes(value))throw Error('Unsupported video setting: '+key);
   result[key]=value;
  }
  return result;
 }
 function videoPrompt(settings) {
  const s=normalizeVideoRequest(settings);
  const prompt=[s.instruction,'Architectural image-to-video. Workflow: '+s.workflow+'. Camera: '+cameras[s.camera]+'. Lighting: '+lights[s.lighting]+'.',
   'Preserve exact building geometry, openings, proportions, layout, materials and landscape. Stable camera movement and verticals; no invented floors, moving windows, melting surfaces or duplicated objects. Only change what the user explicitly requested.'].join('\n');
  if(new TextEncoder().encode(prompt).length>3500)throw Error('The video direction is too long. Shorten it before preparing the video.');
  return prompt;
 }
 function videoQuote(response) {
  const cost=Number(response.credits_cost),reserve=Number(response.credits_reserved),balance=Number(response.credits_available);
  if(!Number.isSafeInteger(cost)||cost<0||!Number.isSafeInteger(reserve)||reserve<cost||!Number.isFinite(balance)||balance<0)throw Error('The server returned an invalid video quote.');
  return {estimated_credits:cost,reservation_credits:reserve,credits_available:balance,can_render:balance>=reserve};
 }
 const api=Object.freeze({normalizeVideoRequest,videoPrompt,videoQuote,cameras,lights});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 scope.PIONXAssistantWorkflows1615=api;
})(typeof window!=='undefined'?window:globalThis);
