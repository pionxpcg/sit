/* PIONX live conversation. Confirmed drafts execute the original image/video pipelines. */
(function (scope) {
 'use strict';
 class VoiceController {
  constructor(bridge, ui, env=scope) { this.bridge=bridge;this.ui=ui;this.env=env;this.epoch=0;this.draftVersion=0;this.calls=new Set();this.responseTools=new Map();this.cancelledResponses=new Set();this.pending=null;this.executing=false;this.preparing=false;this.starting=false; }
  send(event) {
   if(this.dc?.readyState!=='open')return false;
   try{const payload=JSON.stringify(event),limit=Math.min(60000,Number(this.pc?.sctp?.maxMessageSize)||60000);if(new TextEncoder().encode(payload).length>limit)throw Error('Voice message exceeded the connection limit.');this.dc.send(payload);return true;}
   catch{this.ui.status('Could not send this voice message. Try a shorter request.');return false;}
  }
  async shareImage(source,text='This is my current source image. Preserve its design unless I explicitly ask for a specific change.') {
   if(!source||this.dc?.readyState!=='open')return false;
   const epoch=this.epoch;
   try {
    // The original stays in Studio. Only a small JPEG context thumbnail crosses WebRTC.
    const im=new this.env.Image();im.src=source;await im.decode();
    const budget=Math.max(0,Math.min(40000,(Number(this.pc?.sctp?.maxMessageSize)||60000)-4000));
    const canvas=this.env.document.createElement('canvas');let thumb='';
    for(const size of [512,384,256,160]){const ratio=Math.min(1,size/im.naturalWidth,size/im.naturalHeight);canvas.width=Math.max(1,Math.round(im.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(im.naturalHeight*ratio));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);for(const quality of [.65,.45,.30]){thumb=canvas.toDataURL('image/jpeg',quality);if(thumb.length<=budget)break;}if(thumb.length<=budget)break;}
    if(thumb.length>budget||epoch!==this.epoch)return false;
    return this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_image',image_url:thumb},{type:'input_text',text}]}});
   }catch{this.ui.status('The source remains in Studio, but its voice preview could not be sent.');return false;}
  }
  async start({microphone=true}={}) {
   if(this.starting)return;
   if(this.pc){if(this.microphoneMode===microphone)return;this.stop();}
   this.microphoneMode=microphone;
   if(!this.bridge.signedIn())throw Error('Sign in to PIONX first.');
   if(!this.env.isSecureContext||(microphone&&!this.env.navigator?.mediaDevices?.getUserMedia))throw Error('Live voice needs HTTPS and microphone access.');
   this.starting=true;const epoch=++this.epoch;this.ui.status('Connecting…');
   try {
    // Check the authenticated pilot gate before asking for a microphone.
    const token=await this.bridge.request('/server/voice-session-r1613.php',{mode:microphone?'voice':'text'});
    if(epoch!==this.epoch)return;
    const stream=microphone?await this.env.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}):{getTracks:()=>[]};
    if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;
    const pc=this.pc=new this.env.RTCPeerConnection();this.audio=this.env.document.createElement('audio');this.audio.autoplay=microphone;
    pc.ontrack=e=>{if(!microphone)return;this.audio.srcObject=e.streams[0];this.audio.play().catch(()=>this.ui.status('Press Resume audio to hear the assistant.'));};
    stream.getTracks().forEach(t=>pc.addTrack(t,stream));if(!microphone)pc.addTransceiver('audio',{direction:'recvonly'});
    this.dc=pc.createDataChannel('oai-events');
    this.dc.onopen=async()=>{if(epoch!==this.epoch)return;this.ui.status(microphone?'Listening · microphone on':'Text chat connected · microphone off');await this.shareImage(this.bridge.image?.());if(epoch!==this.epoch)return;this.send({type:'response.create',response:{instructions:'Greet the user warmly in Egyptian Arabic, introduce yourself as PIONX AI assistant, then ask what they want to do with their render or video. Mention the upload button if there is no image.'}});};
    this.dc.onmessage=e=>{if(epoch!==this.epoch)return;try{this.event(JSON.parse(e.data));}catch{this.ui.status('Could not read a voice event.');}};
    this.dc.onerror=()=>{if(epoch===this.epoch)this.stop('Voice disconnected. Start a new session.');};
    pc.onconnectionstatechange=()=>{if(epoch!==this.epoch)return;if(['failed','closed','disconnected'].includes(pc.connectionState))this.stop('Voice disconnected. Start a new session.');};
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    const answer=await this.env.fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+token.value,'Content-Type':'application/sdp'},body:offer.sdp,signal:AbortSignal.timeout(20000)});
    if(!answer.ok)throw Error('The voice service could not connect.');
    const sdp=await answer.text();if(epoch!==this.epoch)return;
    await pc.setRemoteDescription({type:'answer',sdp});
    this.timer=this.env.setTimeout(()=>this.stop('Voice session ended after five minutes.'),Math.min(300,Number(token.max_duration_seconds)||300)*1000);
   }catch(e){if(epoch===this.epoch)this.stop(e.message||'Could not start live voice.');throw e;}
   finally{if(epoch===this.epoch)this.starting=false;}
  }
  stop(message='Microphone off') {
   ++this.epoch;++this.draftVersion;this.starting=false;this.env.clearTimeout(this.timer);this.env.clearTimeout(this.jobTimer);this.timer=null;this.responding=false;this.responsePending=false;
   if(this.pc)this.pc.onconnectionstatechange=null;
   this.dc?.close();this.pc?.close();this.stream?.getTracks().forEach(t=>t.stop());
   if(this.audio){this.audio.pause();this.audio.srcObject=null;}
   this.pc=null;this.dc=null;this.stream=null;this.calls.clear();this.responseTools.clear();this.cancelledResponses.clear();this.cancelUnidentifiedResponse=false;this.currentResponse=null;this.pending=null;this.ui.draft(null);this.ui.status(message);
  }
  event(e) {
   if(e.type==='response.function_call_arguments.done'&&e.response_id){let calls=this.responseTools.get(e.response_id);if(!calls){if(this.responseTools.size>=4)return;calls=[];this.responseTools.set(e.response_id,calls);}if(calls.length<10&&!calls.some(call=>call.call_id===e.call_id))calls.push(e);}
   if(e.type==='conversation.item.input_audio_transcription.completed')this.ui.transcript('You',e.transcript);
   if(e.type==='response.output_audio_transcript.done')this.ui.transcript('PIONX',e.transcript);
   if(e.type==='response.output_text.done')this.ui.transcript('PIONX',e.text);
   if(e.type==='input_audio_buffer.speech_started')this.ui.status('Listening…');
   if(e.type==='response.created'){this.responding=true;this.currentResponse=e.response?.id||null;if(this.cancelUnidentifiedResponse&&this.currentResponse){this.cancelledResponses.add(this.currentResponse);this.cancelUnidentifiedResponse=false;}}
   if(e.type==='response.output_audio.delta')this.ui.status('Speaking…');
   if(e.type==='response.done'){this.responding=false;const id=e.response?.id,calls=this.responseTools.get(id)||[],pending=this.responsePending;this.responsePending=false;this.responseTools.delete(id);if(this.currentResponse===id)this.currentResponse=null;this.ui.status(['failed','incomplete'].includes(e.response?.status)?'PIONX could not finish that reply. Please try again.':this.microphoneMode===false?'Text chat connected · microphone off':'Listening · microphone on');const accepted=e.response?.status==='completed'&&!this.cancelledResponses.has(id);if(accepted&&calls.length){for(const call of calls)this.tool(call).catch(()=>{});}else if(pending)this.requestResponse();this.cancelledResponses.delete(id);}
   if(e.type==='error')this.ui.status('Voice service error. Retry or stop the session.');
  }
  requestResponse(){if(this.responding){this.responsePending=true;return;}if(this.send({type:'response.create'}))this.responding=true;}
  cancelActiveResponse(){if(!this.responding)return;if(this.currentResponse)this.cancelledResponses.add(this.currentResponse);else this.cancelUnidentifiedResponse=true;this.send({type:'response.cancel'});}
  message(text) {
   if(typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Enter a request in at most 1000 characters.');
   if(this.dc?.readyState!=='open')throw Error('Start live voice to connect the conversational assistant first.');
   const waitForCancelled=this.responding;
   if(waitForCancelled){this.cancelActiveResponse();this.responsePending=true;}
   this.ui.transcript('You',text.trim());
   this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:text.trim()}]}});
   if(!waitForCancelled)this.requestResponse();
  }
  async tool(e) {
   if(typeof e.call_id!=='string'||this.calls.has(e.call_id))return;
   if(this.calls.size>=100){this.stop('Session tool limit reached.');return;}
   this.calls.add(e.call_id);const epoch=this.epoch;let output;
   try {
    const args=JSON.parse(e.arguments||'{}');
    if(e.name==='get_context'){
     if(!args||Object.keys(args).length)throw Error('Invalid context arguments.');
     output={...this.bridge.context(),capabilities:{conversation:true,image_edit:'prepare_then_visible_confirmation',video_generation:'prepare_then_visible_confirmation',video_status:true,workspace_navigation:true,film:'manual_workspace_workflow',presentation:'manual_workspace_workflow',multi_camera:'manual_workspace_workflow',account_changes:false,publishing:false}};
    }
    else if(e.name==='open_workspace'){
     const allowed=['studio','flow','video','film','presentation','consistency','renders','projects','albums','assets','explore','portfolio','profile','plans','billing','settings'];
     if(!args||Object.keys(args).some(k=>k!=='page')||!allowed.includes(args.page))throw Error('Unsupported workspace page.');
     if(typeof this.bridge.navigateWorkspace!=='function')throw Error('Workspace navigation is unavailable.');
     this.bridge.navigateWorkspace(args.page);output={status:'opened',page:args.page,message:'Opened the workspace only. No paid operation was executed.'};
    }
    else if(e.name==='get_video_status'){
     if(!args||Object.keys(args).length||typeof this.bridge.videoStatus!=='function')throw Error('Video status is unavailable.');
     output=await this.bridge.videoStatus();if(output.message)this.ui.status(output.message);
    }
    else if(e.name==='cancel_pending'){
     if(!args||Object.keys(args).length)throw Error('Invalid cancellation arguments.');
     if(this.executing)throw Error('An operation has already been confirmed. Check its workspace status.');
     this.cancelDraft();output={status:'cancelled',message:'The unconfirmed draft was cancelled. No operation was submitted.'};
    }
    else if(e.name==='prepare_render'||e.name==='prepare_video'){
     if(this.executing||this.preparing)throw Error('A render or draft is already being prepared.');
     if(this.pending)throw Error('A draft is awaiting confirmation. Cancel it before preparing another.');
     const video=e.name==='prepare_video';
     if(video){scope.PIONXAssistantWorkflows1615.normalizeVideoRequest(args);if(typeof this.bridge.prepareVideo!=='function')throw Error('Conversational video is unavailable.');}
     else if(!args||Object.keys(args).some(k=>k!=='instruction')||typeof args.instruction!=='string'||!args.instruction.trim()||args.instruction.length>1000)throw Error('Please describe the specific image edits in at most 1000 characters.');
     const version=this.draftVersion;this.preparing=true;let draft;
     try{draft=video?await this.bridge.prepareVideo(args):await this.bridge.prepare(args.instruction.trim());}finally{this.preparing=false;}
     if(epoch!==this.epoch)return;
     if(version!==this.draftVersion)output={status:'cancelled',message:'The pending preparation was cancelled. Nothing was submitted.'};
     else {this.pending=draft;this.ui.draft(draft);output={status:'awaiting_user_confirmation',operation:video?'video':'image',instruction:draft.instruction,settings:video?draft.options:undefined,estimated_credits:draft.quote.estimated_credits,reservation_credits:draft.quote.reservation_credits,message:'Nothing submitted. The user must press the visible confirmation button.'};}
    }else throw Error('Unsupported assistant tool.');
   }catch(e){output={status:'error',message:e.message||'Tool failed'};}
   if(epoch!==this.epoch)return;
   this.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:JSON.stringify(output)}});
   this.requestResponse();
  }
  cancelDraft(){++this.draftVersion;this.pending=null;this.ui.draft(null);}
  async confirm() {
   if(this.executing||!this.pending)return;
   const draft=this.pending,epoch=this.epoch;const authorized=()=>epoch===this.epoch&&this.pending===draft;
   this.executing=true;this.ui.status(draft.kind==='video'?'Checking quote and starting Video Studio…':'Checking quote and starting Studio…');
   try {
    const quote=await this.bridge.quote(draft);
    if(!authorized())return;
    if(!quote.can_render)throw Error('Insufficient credits for the render reservation.');
    if(quote.estimated_credits!==draft.quote.estimated_credits||quote.reservation_credits!==draft.quote.reservation_credits){draft.quote=quote;this.ui.draft(draft);throw Error('Pricing changed. Review the updated quote and confirm again.');}
    this.ui.draft(null);
    const result=await this.bridge.execute(draft,authorized);
    if(!authorized())return;
    this.pending=null;this.ui.status(result.message);if(result.job_id)this.watchVideo(result.job_id);
    this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Actual workspace result: '+result.message+'. Do not invent additional results or claim that a queued job is finished.'}]}});this.requestResponse();
   }catch(e){this.ui.status(e.message||'Could not execute the render.');if(authorized())this.ui.draft(this.pending);}
   finally{this.executing=false;}
  }
  watchVideo(id){
   this.env.clearTimeout(this.jobTimer);const epoch=this.epoch;
   const poll=async()=>{
    if(epoch!==this.epoch||typeof this.bridge.videoStatus!=='function')return;
    try{const result=await this.bridge.videoStatus();if(epoch!==this.epoch)return;this.ui.status(result.message||result.status);
     if(result.status==='ready'){this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Actual video job '+id+' is ready in Video Studio. Tell the user they can preview and download it.'}]}});this.requestResponse();return;}
     if(['failed','no_job','not_submitted','submission_unknown'].includes(result.status))return;
    }catch(error){if(epoch!==this.epoch)return;this.ui.status(error.message||'Could not check the video status.');if(error.state==='failed')return;}
    this.jobTimer=this.env.setTimeout(poll,9000);
   };
   this.jobTimer=this.env.setTimeout(poll,9000);
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={VoiceController};
 scope.PIONXVoiceController=VoiceController;
 if(!scope.document)return;
 function mount() {
  const bridge=scope.PIONXAssistantBridge1613;if(!bridge)return;
  const ar=()=>scope.PIONX_I18N?.language?.()==='ar'||document.documentElement.lang==='ar';
  const translations={'PIONX AI Assistant':'مساعد PIONX بالذكاء الاصطناعي','🎙 PIONX Assistant':'🎙 مساعد PIONX','Talk naturally about your render or video. Review credits before each operation.':'اتكلم براحتك عن الريندر أو الفيديو. راجع الكريديت قبل تنفيذ كل عملية.','Voice access depends on workspace settings. Sessions last up to five minutes; generation uses the quoted credits.':'إتاحة الصوت تعتمد على إعدادات مساحة العمل. الجلسة حتى خمس دقائق، والتوليد يستخدم الكريديت المعروض.','Start live voice':'ابدأ المحادثة الصوتية','Stop microphone':'إيقاف الميكروفون','Resume audio':'تشغيل الصوت','Upload image':'ارفع صورة','Confirm operation':'تأكيد التنفيذ','Cancel draft':'إلغاء الطلب','Microphone off':'الميكروفون متوقف','Connecting…':'جارٍ الاتصال…','Listening · microphone on':'في انتظار كلامك · الميكروفون يعمل','Listening…':'بسمعك…','Speaking…':'المساعد بيتكلم…','Checking quote and starting Studio…':'جارٍ مراجعة التكلفة وتجهيز الاستوديو…','Image ready. Tell PIONX which changes you want.':'الصورة جاهزة. قل للمساعد التعديلات المطلوبة.','Live voice pilot is not enabled on this server':'المحادثة الصوتية التجريبية لم تُفعّل على هذا السيرفر.','Admin access required':'المحادثة الصوتية التجريبية متاحة للإدارة فقط.','Sign in to PIONX first.':'سجّل دخولك إلى PIONX أولًا.','Live voice needs HTTPS and microphone access.':'المحادثة الصوتية تحتاج اتصال HTTPS والسماح بالميكروفون.','Insufficient credits for the render reservation.':'الرصيد لا يكفي لحجز كريديت الريندر.','Pricing changed. Review the updated quote and confirm again.':'التكلفة تغيرت. راجع التكلفة الجديدة وأكد التنفيذ مرة أخرى.','Voice session ended after five minutes.':'انتهت الجلسة الصوتية بعد خمس دقائق.','Voice disconnected. Start a new session.':'الاتصال الصوتي انقطع. ابدأ جلسة جديدة.','The edited image was delivered in Studio. Review it visually.':'تم تسليم الصورة المعدّلة في الاستوديو. راجع النتيجة بصريًا.'};
  Object.assign(translations,{'Start text chat':'ابدأ محادثة كتابية','Check video status':'راجع حالة الفيديو','Open Video Studio':'افتح استوديو الفيديو','Text chat connected · microphone off':'المحادثة الكتابية متصلة · الميكروفون متوقف','Checking quote and starting Video Studio…':'جارٍ مراجعة التكلفة وتجهيز استوديو الفيديو…','Your video is still rendering.':'جارٍ توليد الفيديو.','Your video is ready in Video Studio.':'الفيديو جاهز في استوديو الفيديو.','The video job was submitted. Follow progress in Video Studio.':'تم إرسال الفيديو للتوليد. تابع التقدم في استوديو الفيديو.','No video job is available.':'لا توجد عملية فيديو متاحة.','Check the previous video submission before starting another.':'راجع طلب الفيديو السابق قبل بدء طلب آخر.','A video is already running. Check Video Studio before preparing another.':'يوجد فيديو قيد التنفيذ. راجع استوديو الفيديو قبل تجهيز طلب آخر.','The starting image changed. Prepare the video again.':'صورة البداية تغيرت. جهّز طلب الفيديو مرة أخرى.'});
  const t=s=>ar()?(translations[s]||scope.PIONX_I18N?.translate?.(s)||s):s;
  const launch=document.createElement('button');launch.className='px-voice-launch';launch.textContent='🎙 PIONX Assistant';launch.type='button';document.body.append(launch);
  const panel=document.createElement('section');panel.className='px-voice-panel';panel.hidden=true;panel.setAttribute('aria-label','PIONX live voice assistant');
  panel.innerHTML='<header><b>PIONX AI Assistant</b><button type="button" data-close aria-label="Close voice assistant">×</button></header><p>Talk naturally about your render or video. Review credits before each operation.</p><p class="px-voice-billing">Sessions last up to five minutes. Review generation credits before confirming.</p><div class="px-voice-controls"><button type="button" data-text>Start text chat</button><button type="button" data-start>Start live voice</button><button type="button" data-stop hidden>End conversation</button><button type="button" data-audio hidden>Resume audio</button></div><div class="px-voice-upload"><button type="button" data-upload>Upload image</button><input id="pxVoiceUpload1616" type="file" accept="image/jpeg,image/png,image/webp" hidden><span class="px-source-label1616" data-source-label>JPG, PNG or WebP · up to 6 MB</span></div><img data-source-preview hidden alt="Uploaded source image" class="px-voice-source"><p data-status role="status" aria-live="polite">Choose text or voice to connect.</p><div data-log class="px-voice-log" role="log" aria-label="Conversation transcript"><div data-empty-chat class="px-chat-empty1616"><strong>What are we creating today?</strong><span>Bring an image or describe your next step.</span></div></div><div class="px-assistant-prompts1616"><button type="button" data-prompt="lighting">Adjust the lighting</button><button type="button" data-prompt="video">Create a video</button><button type="button" data-prompt="help">Help me get started</button></div><form class="px-voice-message"><label data-message-label for="pxVoiceMessage1614">Your request</label><textarea id="pxVoiceMessage1614" data-message maxlength="1000" rows="3" placeholder="Ask PIONX or describe the changes you want"></textarea><button type="submit" data-send disabled>Send request</button></form><div data-draft hidden><p data-instruction></p><p data-quote></p><button type="button" data-confirm>Confirm operation</button><button type="button" data-cancel>Cancel draft</button></div><div class="px-voice-job"><button type="button" data-check-video>Check video status</button><a href="#video" data-video-link>Open Video Studio</a></div>';
  document.body.append(panel);const find=s=>panel.querySelector(s);
  const labelNodes=[launch,...panel.querySelectorAll('b,button,p,a,strong,[data-empty-chat] span,[data-source-label]')].filter(node=>node.childElementCount===0&&!node.matches('[data-instruction],[data-quote]'));labelNodes.forEach(node=>node.dataset.voiceLabel=node.textContent);
  Object.assign(translations,{'PIONX could not finish that reply. Please try again.':'PIONX ما قدرش يكمل الرد. جرّب تاني.','End conversation':'إنهاء المحادثة','Choose text or voice to connect.':'اختار الكتابة أو الصوت لبدء المحادثة.','What are we creating today?':'هنعمل إيه النهارده؟','Bring an image or describe your next step.':'ارفع صورة أو احكي الخطوة اللي عايز تعملها.','Adjust the lighting':'عدّل الإضاءة','Create a video':'أنشئ فيديو','Help me get started':'ساعدني أبدأ','JPG, PNG or WebP · up to 6 MB':'JPG أو PNG أو WebP · حتى 6 ميجابايت','Sessions last up to five minutes. Review generation credits before confirming.':'الجلسة حتى خمس دقائق. راجع كريديت التوليد قبل التأكيد.','Conversations are unavailable in this workspace.':'المحادثة غير متاحة في مساحة العمل حاليًا.','Your request':'طلبك','Send request':'إرسال الطلب','Ask PIONX or describe the changes you want':'اسأل PIONX أو اشرح التعديلات المطلوبة','Start live voice to connect the conversational assistant first.':'ابدأ المحادثة الصوتية أولًا للاتصال بالمساعد.','Enter a request in at most 1000 characters.':'اكتب طلبك بحد أقصى ١٠٠٠ حرف.'});
  const localize=()=>{panel.dir=ar()?'rtl':'ltr';labelNodes.forEach(node=>node.textContent=t(node.dataset.voiceLabel));find('[data-empty-chat]')?.setAttribute('aria-hidden',find('[data-empty-chat]').hidden?'true':'false');find('[data-upload]').textContent=t('Upload image');find('[data-message-label]').textContent=t('Your request');find('[data-message]').placeholder=t('Ask PIONX or describe the changes you want');};localize();
  const ui={status:s=>{const message=/pilot is not enabled|not configured/.test(s)?'Conversations are unavailable in this workspace.':s;find('[data-status]').dataset.voiceLabel=message;find('[data-status]').textContent=t(message);find('[data-audio]').hidden=!s.includes('Resume audio');queueMicrotask(syncControls);},transcript:(who,text)=>{if(!text)return;find('[data-empty-chat]').hidden=true;const p=document.createElement('p');p.dataset.speaker=who;p.setAttribute('data-i18n-skip','');p.textContent=(ar()&&who==='You'?'أنت':who)+': '+text;find('[data-log]').append(p);while(find('[data-log]').querySelectorAll('p').length>30)find('[data-log]').querySelector('p').remove();p.scrollIntoView({block:'nearest'});},draft:d=>{find('[data-draft]').hidden=!d;if(d){find('[data-instruction]').textContent=d.instruction;find('[data-quote]').textContent=ar()?'التكلفة التقديرية: '+d.quote.estimated_credits+' كريديت · الحجز المؤقت: '+d.quote.reservation_credits+' كريديت. تسوية التكلفة تتم عبر نظام الريندر الحالي.':'Estimated: '+d.quote.estimated_credits+' credits · reservation: '+d.quote.reservation_credits+' credits. Existing render settlement applies.';find('[data-confirm]').disabled=!d.quote.can_render;if(d.kind==='video'){const info=(ar()?'فيديو':'Video')+' · '+d.options.duration+' '+(ar()?'ثوانٍ':'seconds')+' · '+d.options.aspect_ratio+' · '+t(d.options.camera==='orbit'?'Orbit':scope.PIONXAssistantWorkflows1615.cameras[d.options.camera]);find('[data-instruction]').textContent=info+'\n'+d.instruction;} }}};
  const controller=new VoiceController(bridge,ui);let connectionHealth17=null,healthSerial17=0;
  const healthBanner17=document.createElement('div');healthBanner17.className='px-conversation-health17';healthBanner17.hidden=true;healthBanner17.innerHTML='<span></span><button type="button" hidden></button>';panel.querySelector('header').after(healthBanner17);
  healthBanner17.querySelector('button').onclick=()=>scope.PIONXConversationSettings1617?.navigate();
  async function refreshAvailability17(){if(!bridge.signedIn()||!scope.PIONXConversationSettings1617)return;const serial=++healthSerial17;try{const health=await scope.PIONXConversationSettings1617.check();if(serial!==healthSerial17)return;connectionHealth17=health;healthBanner17.hidden=health.available;healthBanner17.dataset.available=String(health.available);const messages={disabled:ar()?'المحادثات الحية مغلقة حاليًا. الإدارة تقدر تفعّلها من إعدادات المحادثة.':'Live conversations are disabled. An administrator can enable them in Conversation settings.',not_configured:ar()?'اتصال المحادثة غير مُعد على السيرفر. راجع الإدارة.':'The workspace conversation connection is not configured. Contact an administrator.',restricted:ar()?'المحادثة متاحة للإدارة فقط حاليًا.':'Live conversations are currently available to administrators only.'};healthBanner17.querySelector('span').textContent=messages[health.reason]||'';const button=healthBanner17.querySelector('button');button.hidden=!health.admin;button.textContent=ar()?'إعدادات المحادثة':'Conversation settings';syncControls();}catch{healthBanner17.hidden=false;healthBanner17.querySelector('span').textContent=ar()?'تعذر فحص حالة المحادثة. حدّث الصفحة أو جرّب الاتصال.':'Conversation availability could not be checked. Refresh or try connecting.';}}
  function syncControls(){const connected=controller.dc?.readyState==='open';panel.dataset.connected=String(connected);find('[data-send]').disabled=!connected;find('[data-stop]').hidden=!connected;find('[data-start]').hidden=connected&&controller.microphoneMode!==false;find('[data-text]').hidden=connected&&controller.microphoneMode===false;find('[data-start]').disabled=controller.starting||connectionHealth17?.available===false;find('[data-text]').disabled=controller.starting||connectionHealth17?.available===false;}
  find('[data-upload]').onclick=()=>find('input[type=file]').click();
  panel.querySelectorAll('[data-prompt]').forEach(button=>button.onclick=()=>{const prompts={lighting:ar()?'عايز أعدل الإضاءة مع الحفاظ على التصميم.':'I want to adjust the lighting while preserving the design.',video:ar()?'عايز أحول الصورة لفيديو. ساعدني أختار حركة الكاميرا والمدة.':'I want to turn the image into a video. Help me choose the camera movement and duration.',help:ar()?'عايز أبدأ مشروع جديد. ساعدني أحدد الخطوة المناسبة.':'I want to start a new project. Help me choose the next step.'};find('[data-message]').value=prompts[button.dataset.prompt];find('[data-message]').focus();});syncControls();
  const preview=()=>{const image=bridge.image?.();find('[data-source-preview]').hidden=!image;if(image)find('[data-source-preview]').src=image;};
  const open=()=>{localize();preview();syncControls();panel.hidden=false;void refreshAvailability17();};
  launch.onclick=()=>{bridge.navigateAssistant?.();open();find('[data-message]').focus();};
  find('[data-start]').onclick=()=>controller.start().catch(e=>ui.status(e.message));
  find('[data-text]').onclick=()=>controller.start({microphone:false}).catch(e=>ui.status(e.message));
  find('[data-check-video]').onclick=async()=>{try{const result=await bridge.videoStatus();ui.status(result.message||result.status);}catch(error){ui.status(error.message);}};
  find('[data-stop]').onclick=()=>controller.stop();find('[data-close]').onclick=()=>{controller.stop();panel.hidden=true;launch.focus();};
  find('[data-audio]').onclick=()=>controller.audio?.play().catch(()=>ui.status('Audio playback is blocked by your browser.'));
  find('[data-confirm]').onclick=()=>controller.confirm();find('[data-cancel]').onclick=()=>controller.cancelDraft();
  find('form').onsubmit=e=>{e.preventDefault();try{controller.message(find('[data-message]').value);find('[data-message]').value='';}catch(err){ui.status(err.message);}};
  find('input').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(controller.executing)return ui.status('Wait for the current render before changing the source.');controller.cancelDraft();controller.cancelActiveResponse();try{const image=await bridge.upload(file);preview();find('[data-source-label]').textContent=file.name;find('[data-source-label]').setAttribute('data-i18n-skip','');ui.status('Image ready. Tell PIONX which changes you want.');await controller.shareImage(image,'I uploaded this image. Preserve its design and clarify ambiguous requests.');controller.requestResponse();}catch(err){ui.status(err.message);}};
  const render=()=>'<section class="page px-assistant-page1614" dir="'+(ar()?'rtl':'ltr')+'"><div class="px-assistant-heading1614"><span>PIONX AI</span><h1>'+(ar()?'تحدث مع PIONX':'Talk to PIONX')+'</h1><p>'+(ar()?'من صورتك للفكرة اللي في بالك. اطلب تعديل أو فيديو، وراجع الطلب قبل التنفيذ.':'From your image to your next idea. Request an edit or a video, then review before execution.')+'</p></div><div class="px-assistant-layout1614"><div id="pionxAssistantHost1614"></div></div><details class="px-assistant-help1616"><summary>'+(ar()?'إزاي المحادثة بتشتغل؟':'How does this work?')+'</summary><p>'+(ar()?'ارفع صورة، واحكي المطلوب. المساعد يجهّز الإعدادات والتكلفة، وأنت تأكد التنفيذ. الفيلم والعروض والزوايا المتعددة متاحة في كل الأدوات، وتُنفّذ داخل مساحاتها.':'Upload an image and describe your goal. PIONX prepares the settings and credit quote for your confirmation. Film, presentations and multiple cameras are available in All tools and run in their workspaces.')+'</p><p>'+(ar()?'الجلسة حتى خمس دقائق. إتاحة المحادثة تعتمد على إعدادات حسابك ومساحة العمل.':'Sessions last up to five minutes. Conversation access depends on your account and workspace settings.')+'</p></details></section>';
  const attach=host=>{if(!host)return;launch.hidden=true;host.append(panel);panel.classList.add('px-voice-inline');open();};
  scope.PIONXVoiceAssistant1614={render,mount:attach,open,stop:()=>controller.stop()};
  bridge.registerAssistant?.({render,mount:attach});
  scope.addEventListener('pionx:language',()=>{localize();bridge.refreshAssistant?.();});
  scope.addEventListener('pagehide',()=>controller.stop());scope.addEventListener('pionx-assistant-exit',()=>controller.stop());scope.addEventListener('hashchange',()=>{launch.hidden=location.hash==='#assistant';if(!bridge.signedIn())controller.stop('Sign in to continue.');if(!panel.isConnected){document.body.append(panel);panel.classList.remove('px-voice-inline');}if(location.hash!=='#assistant'&&!controller.pc&&!controller.pending&&!controller.executing)panel.hidden=true;});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
