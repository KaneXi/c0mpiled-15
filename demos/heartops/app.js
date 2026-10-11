(() => {
  'use strict';

  const shift = Object.freeze({
    date: '2026-10-17',
    startMinutes: 600,
    endMinutes: 720,
    qualification: 'setup',
    needed: 3,
    assigned: 2,
  });

  const candidates = [
    { id: 'jamie', name: 'Jamie Chen', firstName: 'Jamie', photo: 'assets/story-3.jpg', qualifications: ['setup'], availability: [{ date: shift.date, startMinutes: 540, endMinutes: 780 }] },
    { id: 'morgan', name: 'Morgan Lee', firstName: 'Morgan', photo: 'assets/story-2.jpg', qualifications: ['setup'], availability: [{ date: shift.date, startMinutes: 600, endMinutes: 750 }] },
    { id: 'sam', name: 'Sam Rivera', firstName: 'Sam', photo: 'assets/story-1.jpg', qualifications: ['setup'], availability: [{ date: shift.date, startMinutes: 780, endMinutes: 900 }] },
  ];

  function isEligible(candidate, targetShift = shift) {
    return Boolean(candidate &&
      candidate.qualifications.includes(targetShift.qualification) &&
      candidate.availability.some(slot =>
        slot.date === targetShift.date &&
        slot.startMinutes <= targetShift.startMinutes &&
        slot.endMinutes >= targetShift.endMinutes));
  }

  function initialState() {
    return { stage: 0, candidateId: 'jamie' };
  }

  function transition(state, action) {
    if (action.type === 'RESET') return initialState();
    if (action.type === 'SELECT_CANDIDATE' && state.stage === 0) {
      const candidate = candidates.find(person => person.id === action.candidateId);
      return isEligible(candidate) ? { ...state, candidateId: candidate.id } : state;
    }
    const candidate = candidates.find(person => person.id === state.candidateId);
    if (!isEligible(candidate)) return state;
    const nextStages = { APPROVE_OUTREACH: 0, SIMULATE_ACCEPTANCE: 1, CONFIRM_REPLACEMENT: 2 };
    if (Object.hasOwn(nextStages, action.type) && state.stage === nextStages[action.type]) {
      return { ...state, stage: state.stage + 1 };
    }
    return state;
  }

  function coverage(state) {
    return { assigned: shift.assigned + (state.stage === 3 ? 1 : 0), needed: shift.needed };
  }

  function draftMessage(candidate) {
    return `Hi ${candidate.firstName}, can you help with Community Pantry setup on Sat, Oct 17, 10 am–12 pm at Oak Street Center? Please reply if you’re available.`;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { shift, candidates, isEligible, initialState, transition, coverage, draftMessage };
  }

  if (typeof document === 'undefined') return;

  function initialize() {
    const mount = document.getElementById('rescue-ui');
    const announcement = document.getElementById('demo-announcement');
    let state = initialState();
    let alternativesOpen = false;

    function announce(message) {
      if (announcement) announcement.textContent = message;
    }

    function render() {
      if (!mount) return;
      const candidate = candidates.find(person => person.id === state.candidateId);
      const count = coverage(state);
      const statuses = ['Open shift', 'Awaiting reply', 'Confirmation needed', 'Shift covered'];
      const statusClasses = ['warning', 'pending', 'pending', 'success'];
      const messages = [
        '<strong>Alex canceled.</strong> One setup spot needs cover.',
        `<strong>Outreach approved.</strong> Waiting for ${candidate.firstName}’s reply.`,
        `<strong>${candidate.firstName} replied:</strong> “I’m available. Happy to help!”`,
        `<strong>${candidate.firstName} is confirmed.</strong> This sample shift is fully covered.`,
      ];
      const labels = ['Open shift', 'Outreach', 'Response', 'Covered'];
      const candidateLabel = state.stage === 0 ? 'Suggested volunteer' : 'Selected volunteer';
      const visibleCandidates = state.stage === 0 && alternativesOpen ? candidates : [candidate];
      const buttons = [
        ['APPROVE_OUTREACH', 'Approve outreach'],
        ['SIMULATE_ACCEPTANCE', 'Simulate acceptance'],
        ['CONFIRM_REPLACEMENT', 'Confirm replacement'],
        ['RESET', 'Replay demo'],
      ];
      const notes = [
        'Approval starts sample outreach. The shift stays open.',
        'Sample outreach only. No message has been sent.',
        'Acceptance is simulated. Confirm to assign this sample shift.',
        'Demo complete. No real schedule has changed.',
      ];
      const button = buttons[state.stage];
      mount.innerHTML = `
        <div class="demo-metrics">
          <div class="demo-metric"><span>Shift coverage</span><strong>${count.assigned}<span> / ${count.needed}</span></strong></div>
          <div class="demo-metric"><span>Open spots</span><strong>${count.needed - count.assigned}</strong></div>
          <div class="assigned-people" aria-label="${count.assigned} of ${count.needed} volunteers assigned">
            <div class="avatar-stack"><img src="assets/story-1.jpg" alt=""><img src="assets/story-2.jpg" alt="">${state.stage === 3 ? `<img src="${candidate.photo}" alt="">` : ''}</div>
          </div>
        </div>
        <div class="incident-heading"><h3>Community Pantry setup</h3><span class="status-pill ${statusClasses[state.stage]}">${statuses[state.stage]}</span></div>
        <div class="shift-detail">
          <div class="detail-item">Sat, Oct 17 · 10 am–12 pm</div>
          <div class="detail-item">Oak Street Center</div>
        </div>
        <div class="message-bubble">${messages[state.stage]}</div>
        <div class="candidate-section">
          <div class="mini-label">${candidateLabel}${state.stage === 0 ? '<button type="button" class="demo-action secondary" data-action="alternatives" aria-expanded="' + alternativesOpen + '" aria-controls="demo-candidates">' + (alternativesOpen ? 'Hide alternatives' : 'View alternatives') + '</button>' : ''}</div>
          <div class="candidate-list" id="demo-candidates" role="radiogroup" aria-label="Suggested volunteers">
            ${visibleCandidates.map(person => {
              const eligible = isEligible(person);
              const selected = person.id === state.candidateId;
              return `<label class="candidate-option${selected ? ' selected' : ''}${!eligible ? ' unavailable' : ''}">
                <input type="radio" name="candidate" value="${person.id}"${selected ? ' checked' : ''}${!eligible || state.stage !== 0 ? ' disabled' : ''}>
                <img class="candidate-avatar" src="${person.photo}" alt="">
                <span class="candidate-info"><strong>${person.name}</strong><span>${eligible ? 'Available · Setup qualified' : 'Time conflict · Unavailable'}</span></span>
                <span class="match-tag">${eligible ? (state.stage === 3 ? 'Confirmed' : 'Qualified') : 'Unavailable'}</span>
              </label>`;
            }).join('')}
          </div>
        </div>
        <div class="draft-message"><span class="mini-label">${state.stage === 0 ? 'Outreach draft' : 'Sample outreach'}</span><p>${draftMessage(candidate)}</p></div>
        <button class="demo-action" type="button" data-action="${button[0]}">${button[1]}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <p class="demo-bottom-note">${notes[state.stage]}</p>
        <ol class="workflow-track" aria-label="Sample recovery progress">${labels.map((label, index) => `<li class="workflow-step${index < state.stage ? ' done' : ''}${index === state.stage ? ' current' : ''}"${index === state.stage ? ' aria-current="step"' : ''}><span aria-hidden="true">${index + 1}</span>${label}</li>`).join('')}</ol>`;
    }

    function focusAction() {
      mount?.querySelector('.demo-action:not(.secondary)')?.focus({ preventScroll: true });
    }

    function reset() {
      state = transition(state, { type: 'RESET' });
      alternativesOpen = false;
      render();
      announce('Demo reset. Alex canceled. Two of three spots are covered. Review Jamie Chen and the outreach draft.');
    }

    mount?.addEventListener('change', event => {
      if (!event.target.matches('input[name="candidate"]')) return;
      const next = transition(state, { type: 'SELECT_CANDIDATE', candidateId: event.target.value });
      if (next === state) return;
      state = next;
      render();
      mount.querySelector(`input[value="${state.candidateId}"]`)?.focus({ preventScroll: true });
      announce(`${candidates.find(person => person.id === state.candidateId).name} selected. Outreach draft updated.`);
    });

    mount?.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'alternatives') {
        alternativesOpen = !alternativesOpen;
        render();
        mount.querySelector('[data-action="alternatives"]')?.focus({ preventScroll: true });
        return;
      }
      if (action === 'RESET') {
        reset();
      } else {
        const next = transition(state, { type: action });
        if (next === state) return;
        state = next;
        alternativesOpen = false;
        render();
        const name = candidates.find(person => person.id === state.candidateId).name;
        announce([
          '',
          `Outreach approved for ${name}. No real message was sent. The sample shift remains open, awaiting a reply.`,
          `${name} accepted in the simulation. The sample shift is still open until you confirm the replacement.`,
          `${name} is confirmed in the demo. Three of three spots are covered. No real schedule was changed.`,
        ][state.stage]);
      }
      focusAction();
    });

    document.getElementById('reset-demo')?.addEventListener('click', () => {
      reset();
      focusAction();
    });
    document.querySelectorAll('[data-start-demo]').forEach(control => {
      control.addEventListener('click', event => {
        event.preventDefault();
        reset();
        document.getElementById('product-demo')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
        focusAction();
      });
    });

    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    function setMenu(open) {
      if (!menuToggle || !mobileNav) return;
      menuToggle.setAttribute('aria-expanded', String(open));
      mobileNav.hidden = !open;
      mobileNav.classList.toggle('open', open);
      menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    }
    menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
    mobileNav?.addEventListener('click', event => {
      if (event.target.closest('a, button')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
      }
    });
    setMenu(false);

    const photoStrip = document.querySelector('.people-strip');
    const photos = photoStrip ? [...photoStrip.querySelectorAll('.people-card[data-photo]')] : [];
    let activePhoto = photos.find(photo => photo.classList.contains('active')) || photos[0];
    let lastPointer = null;
    function activatePhoto(photo) {
      if (!photo || photo === activePhoto) return;
      activePhoto?.classList.remove('active');
      activePhoto?.setAttribute('aria-pressed', 'false');
      activePhoto = photo;
      activePhoto.classList.add('active');
      activePhoto.setAttribute('aria-pressed', 'true');
    }
    activePhoto?.classList.add('active');
    photos.forEach(photo => {
      photo.addEventListener('click', () => activatePhoto(photo));
      photo.addEventListener('focusin', () => activatePhoto(photo));
    });
    photoStrip?.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      if (lastPointer && lastPointer.x === event.clientX && lastPointer.y === event.clientY) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      activatePhoto(event.target.closest('.people-card[data-photo]'));
    });
    photoStrip?.addEventListener('pointerleave', () => { lastPointer = null; });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
