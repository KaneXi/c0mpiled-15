const stories = [
  {name:'Amina & Leila',title:'A little care. A whole community.',category:'Food & community',summary:'A shared meal can be the beginning of something bigger — connection, dignity, and a place to belong.',position:'50% 50%'},
  {name:'Sofia',title:'A new chapter starts here.',category:'Education & opportunity',summary:'With a welcoming classroom and someone in her corner, Sofia is finding the confidence to write her next chapter.',position:'50% 42%'},
  {name:'Maya',title:'Room to dream a little bigger.',category:'Education & opportunity',summary:'An after-school creative space gives Maya the tools, encouragement, and freedom to discover her own voice.',position:'50% 40%'},
  {name:'Daniel',title:'Showing up changes things.',category:'Food & community',summary:'For Daniel, volunteering begins with one simple idea: everyone deserves to be met with kindness.',position:'50% 40%'},
  {name:'Lina',title:'A place to feel at home.',category:'Care & belonging',summary:'A neighborhood gathering becomes a circle of support, where familiar faces make a new place feel like home.',position:'50% 40%'},
  {name:'James',title:'Small moments. Lasting connection.',category:'Care & belonging',summary:'A regular visit, a warm conversation, a helping hand. James reminds us that care lives in everyday moments.',position:'50% 40%'},
  {name:'Grace',title:'Good grows when we share it.',category:'Food & community',summary:'Grace imagines a community garden where neighbors share more than a harvest — they share hope.',position:'50% 40%'},
  {name:'Noor',title:'The future has her voice in it.',category:'Education & opportunity',summary:'An opportunity to learn becomes an opportunity to lead. Noor is ready to bring others along with her.',position:'50% 40%'},
  {name:'Elena',title:'Kindness is a place to begin.',category:'Care & belonging',summary:'Elena’s story is a reminder that a small act of generosity can open the door to a new connection.',position:'50% 40%'}
];

const gallery = document.querySelector('.story-gallery');
const panel = document.querySelector('.content-panel');
const panelContent = document.querySelector('#panel-content');
const panelHeading = document.querySelector('#panel-heading');
const mobileMedia = window.matchMedia('(max-width: 760px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeIndex = 0;
let panelTrigger;

gallery.innerHTML = stories.map((story, index) => `
  <article class="story-card ${index === 0 ? 'is-active' : ''}" style="--position:${story.position}">
    <button class="story-select" type="button" aria-label="Select ${story.name}'s sample story: ${story.category}" aria-pressed="${index === 0}" data-story="${index}">
      <img src="assets/story-${index + 1}.jpg" alt="" ${index === 0 ? 'fetchpriority="high"' : ''} draggable="false" width="700" height="1000">
      <span class="story-number">${String(index + 1).padStart(2,'0')} / 09</span>
      <span class="story-caption"><span class="story-name">${story.name}</span><span class="story-summary">${story.summary}</span></span>
    </button>
  </article>`).join('');

const cards = [...gallery.querySelectorAll('.story-card')];
function selectStory(index, scroll = false) {
  activeIndex = index;
  cards.forEach((card, i) => {
    card.classList.toggle('is-active', i === index);
    card.querySelector('button').setAttribute('aria-pressed', String(i === index));
  });
  if (scroll && mobileMedia.matches) cards[index].scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth', block:'nearest', inline:'start'});
}

let lastPointerPosition;
gallery.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || mobileMedia.matches) return;
  const point = {x:event.clientX, y:event.clientY};
  if (lastPointerPosition && Math.hypot(point.x-lastPointerPosition.x, point.y-lastPointerPosition.y) < 3) return;
  lastPointerPosition = point;
  const button = event.target.closest('[data-story]');
  if (button && Number(button.dataset.story) !== activeIndex) selectStory(Number(button.dataset.story));
});

cards.forEach((card, index) => {
  const button = card.querySelector('button');
  button.addEventListener('click', event => { lastPointerPosition = {x:event.clientX, y:event.clientY}; selectStory(index, true); });
  button.addEventListener('focus', () => selectStory(index));
  button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % stories.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + stories.length) % stories.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = stories.length - 1;
    if (next !== undefined) {event.preventDefault(); cards[next].querySelector('button').focus({preventScroll:true});selectStory(next, true);}
  });
});

// On touch screens the visible story remains the selected story after a swipe.
let scrollTimer;
gallery.addEventListener('scroll', () => {
  if (!mobileMedia.matches) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const start = gallery.getBoundingClientRect().left + 22;
    const distances = cards.map(card => Math.abs(card.getBoundingClientRect().left - start));
    selectStory(distances.indexOf(Math.min(...distances)));
  }, 100);
}, {passive:true});

const headings = {programs:'Together, we make room for change.',advocacy:'The stories behind the support.',contact:'Let’s start a conversation.',share:'Every story deserves to be heard.',all:'Meet the voices.',donate:'Make a little good go further.'};
const note = '<p class="demo-note">Prototype only. These are fictional sample stories; the photographs are illustrative.</p>';

function formMarkup(kind) {
  const share = kind === 'share';
  return `<p class="panel-lead">${share ? 'Try sharing a moment that made a difference in your community.' : 'Have an idea for bringing people together? Try the contact form.'} This form creates a preview on your device; nothing is sent.</p>
    <form class="local-form" id="message-form">
      <div class="field"><label for="your-name">Your name</label><input id="your-name" name="name" required maxlength="80" autocomplete="name" placeholder="How should we call you?"></div>
      <div class="field"><label for="your-message">${share ? 'Your story' : 'Your message'}</label><textarea id="your-message" name="message" required minlength="15" maxlength="2000" placeholder="${share ? 'It started with…' : 'I would love to…'}"></textarea></div>
      <button class="button button-orange" type="submit">Preview ${share ? 'my story' : 'message'}</button>
      <div class="form-status" role="status" hidden></div>
    </form>`;
}

function donationMarkup() {
  return `<div class="donation-layout"><div class="donation-context"><h3>A small gift.<br>A more connected community.</h3><p>Explore what a simple donation experience could feel like. Choose a cause and an amount to review your sample gift.</p><span class="preview-tag">Demo only · No payment will be taken</span></div>
    <form class="local-form" id="donation-form">
      <div class="field"><label for="cause">Choose a cause</label><select id="cause" name="cause"><option>Food & community</option><option>Education & opportunity</option><option>Care & belonging</option></select></div>
      <fieldset><legend class="field-label">Your one-time gift · USD</legend><div class="amount-options">${[10,25,50,100].map(amount=>`<button type="button" class="amount-option" aria-pressed="${amount===25}" data-amount="${amount}">$${amount}</button>`).join('')}</div></fieldset>
      <div class="field"><label for="gift-amount">Amount in USD</label><input id="gift-amount" type="number" name="amount" min="1" max="10000" step="0.01" value="25" required inputmode="decimal"></div>
      <button class="button button-orange" type="submit">Preview donation</button>
      <p class="demo-note">This prototype does not collect payment information or transfer money.</p>
    </form></div>`;
}

function showPanel(kind, trigger) {
  panelTrigger = trigger || document.querySelector(`[data-panel="${kind}"]`);
  panelHeading.textContent = headings[kind];
  if (kind === 'all') panelContent.innerHTML = `<p class="panel-lead">Nine imagined voices. A shared belief in what we can do together.</p><div class="story-list">${stories.map((s,i)=>`<button type="button" class="story-list-item" data-view-story="${i}"><img src="assets/story-${i+1}.jpg" alt="" width="76" height="96" loading="lazy"><span><span class="list-name">${s.name}</span><span class="list-category">${s.category}</span></span></button>`).join('')}</div>${note}`;
  if (kind === 'programs') panelContent.innerHTML = `<p class="panel-lead">Three example causes that connect a donation to a human story. These programs are concepts for this prototype.</p><div class="program-list">${[
    ['Food & community','Shared meals, welcoming spaces, and a sense of connection around the table.'],
    ['Education & opportunity','Learning spaces where curiosity is encouraged and new possibilities can take root.'],
    ['Care & belonging','Everyday support that helps people feel seen, heard, and part of their community.']
  ].map(([title,copy])=>`<article><h3>${title}</h3><p>${copy}</p><button type="button" class="text-button" data-support="${title}">Explore a sample gift</button></article>`).join('')}</div>${note}`;
  if (kind === 'advocacy') panelContent.innerHTML = `<article class="article"><h3>Begin with a person, not a number.</h3><p>A meaningful donation story starts with listening. What matters to a community? What do people want to share? And how can support follow their priorities?</p><p>In a finished donation platform, a story should be shared with permission, an outcome should be backed by evidence, and a donor should be able to understand how their gift was used.</p><p>This page explores the first part: helping visitors connect with a story. The next step is to connect that experience to verified updates from a nonprofit.</p>${note}</article>`;
  if (kind === 'share' || kind === 'contact') panelContent.innerHTML = formMarkup(kind);
  if (kind === 'donate') panelContent.innerHTML = donationMarkup();
  panel.hidden = false;
  closeMenu();
  panelHeading.focus({preventScroll:true});
  panel.scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth',block:'start'});
  const messageForm = document.querySelector('#message-form');
  if (messageForm) messageForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(messageForm);
    const name = String(data.get('name')).trim();
    const message = String(data.get('message')).trim();
    if (!name || message.length < 15) {
      const status = messageForm.querySelector('.form-status');
      status.hidden = false;status.textContent = 'Please enter your name and at least 15 characters of meaningful text.';
      return;
    }
    const status = messageForm.querySelector('.form-status');status.hidden=false;
    status.replaceChildren();
    const label = document.createElement('strong');label.textContent=`${name} — ${kind === 'share' ? 'story' : 'message'} preview`;
    const copy = document.createElement('p');copy.textContent=message;
    const disclaimer=document.createElement('p');disclaimer.className='demo-note';disclaimer.textContent='Preview only. Nothing was sent or saved; closing this section clears the preview.';
    status.append(label,copy,disclaimer);
  });
  const donationForm = document.querySelector('#donation-form');
  if (donationForm) {
    const amountInput = donationForm.querySelector('#gift-amount');
    donationForm.querySelectorAll('[data-amount]').forEach(button=>button.addEventListener('click',()=>{
      amountInput.value=button.dataset.amount;updateAmounts();
    }));
    function updateAmounts(){donationForm.querySelectorAll('[data-amount]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.amount)===Number(amountInput.value))));}
    amountInput.addEventListener('input',updateAmounts);
    donationForm.addEventListener('submit',event=>{
      event.preventDefault();
      const amount = Number(amountInput.value);
      const cause = donationForm.querySelector('#cause').value;
      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return;
      const formatted = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
      panelContent.innerHTML=`<div class="donation-preview" role="status"><h3 class="donation-summary">Your ${formatted} gift preview</h3><p>You selected a one-time gift for <strong>${cause}</strong>.</p><p class="demo-note">This is an interaction preview. No donation was made, no payment information was collected, and no receipt was issued.</p><button class="button button-outline" type="button" data-panel="donate">Try another amount</button></div>`;
      panelHeading.focus({preventScroll:true});
    });
  }
}

document.addEventListener('click', event => {
  const panelButton=event.target.closest('[data-panel]');
  if(panelButton) showPanel(panelButton.dataset.panel,panelButton);
  const storyButton=event.target.closest('[data-view-story]');
  if(storyButton){const index=Number(storyButton.dataset.viewStory);selectStory(index,true);cards[index].querySelector('button').focus({preventScroll:true});document.querySelector('#stories').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});}
  const supportButton=event.target.closest('[data-support]');
  if(supportButton){const cause=supportButton.dataset.support;showPanel('donate',document.querySelector('.donate-nav'));document.querySelector('#cause').value=cause;}
});
document.querySelector('.close-panel').addEventListener('click',()=>{panel.hidden=true;panelContent.replaceChildren();if(panelTrigger?.isConnected)panelTrigger.focus({preventScroll:true});document.querySelector('#stories').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});});
const menuToggle=document.querySelector('.menu-toggle');
const mobileMenu=document.querySelector('#mobile-menu');
function closeMenu(){mobileMenu.hidden=true;menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Open menu');}
menuToggle.addEventListener('click',()=>{const expanded=menuToggle.getAttribute('aria-expanded')==='true';mobileMenu.hidden=expanded;menuToggle.setAttribute('aria-expanded',String(!expanded));menuToggle.setAttribute('aria-label',expanded?'Open menu':'Close menu');});
mobileMenu.querySelector('a').addEventListener('click',closeMenu);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!mobileMenu.hidden){closeMenu();menuToggle.focus();}});
mobileMedia.addEventListener('change',()=>{closeMenu();selectStory(activeIndex);});
