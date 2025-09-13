
/* pi-coin-Carrot location filter (patched 2025-09-13)
 * Fixes:
 *  - Prevents selects from re-disabling immediately after activating
 *  - Binds event listeners only once
 *  - Ensures consistent state on modal open without forcing reset
 *  - Sidebar chip rendering after apply
 */

(function(){
  // ---- Simple dataset (extend as needed) ----
  const DATA = {
    "서울특별시": {
      "강남구": ["개포동","도곡동","역삼동","압구정동","청담동"],
      "강동구": ["천호동","길동","둔촌동","고덕동"],
      "강북구": ["미아동","수유동","우이동"],
      "관악구": ["봉천동","신림동"]
    },
    "부산광역시": {
      "해운대구": ["우동","중동","좌동"],
      "수영구": ["광안동","남천동"]
    }
  };

  // ---- Element getters ----
  const $ = (sel, root=document) => root.querySelector(sel);

  // These IDs/classes should match your HTML
  const SELECTORS = {
    modal: '#locationFilterModal',
    openBtn: '#openLocationFilterBtn',
    resetBtn: '#btnLocationReset',
    applyBtn: '#btnLocationApply',
    sido: '#selectSido',
    gugun: '#selectGugun',
    dong: '#selectDong',
    sidebar: '#leftSidebarFilters',
    chips: '#activeFilters'
  };

  // Guard flags
  let initialized = false;
  let opening = false;

  function setDisabled(el, disabled){
    if(!el) return;
    el.disabled = !!disabled;
    el.classList.toggle('is-disabled', !!disabled);
  }

  function clearOptions(sel){
    if(!sel) return;
    while(sel.options.length) sel.remove(0);
  }

  function addOption(sel, value, label, selected=false){
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if(selected) opt.selected = true;
    sel.appendChild(opt);
  }

  // Populate Sido every time (fast)
  function populateSido(){
    const sido = $(SELECTORS.sido);
    if(!sido) return;
    const current = sido.value; // keep current if exists
    clearOptions(sido);
    addOption(sido, "", "시/도를 선택하세요");
    Object.keys(DATA).forEach(s => addOption(sido, s, s, s===current));
  }

  function populateGugun(){
    const sido = $(SELECTORS.sido);
    const gugun = $(SELECTORS.gugun);
    if(!gugun) return;

    clearOptions(gugun);
    addOption(gugun, "", "구/군을 선택하세요");
    if(!sido || !sido.value || !DATA[sido.value]) {
      setDisabled(gugun, true);
      return;
    }
    Object.keys(DATA[sido.value]).forEach(g => addOption(gugun, g, g));
    setDisabled(gugun, false);
  }

  function populateDong(){
    const sido = $(SELECTORS.sido);
    const gugun = $(SELECTORS.gugun);
    const dong = $(SELECTORS.dong);
    if(!dong) return;

    clearOptions(dong);
    addOption(dong, "", "동을 선택하세요 (선택사항)");

    if(!sido || !sido.value || !gugun || !gugun.value) {
      // 동은 선택사항이므로 비워두되 비활성화는 하지 않음 (요구시만 disable)
      setDisabled(dong, false);
      return;
    }

    const list = (DATA[sido.value] && DATA[sido.value][gugun.value]) || [];
    list.forEach(d => addOption(dong, d, d));
    setDisabled(dong, false);
  }

  // Ensures dependent selects follow current selections
  function ensureLocationSelectsState(){
    populateSido();
    // If current value no longer exists, reset to ""
    const sido = $(SELECTORS.sido);
    if(!sido) return;
    if(!DATA[sido.value]) sido.value = "";

    populateGugun();
    const gugun = $(SELECTORS.gugun);
    if(gugun && (!sido.value || !DATA[sido.value][gugun.value])) gugun.value = "";

    populateDong();
    const dong = $(SELECTORS.dong);
    if(dong && !dong.value) {
      // keep enabled; no forced disabling to avoid the "blink-disable" bug
      setDisabled(dong, false);
    }
  }

  // Render active filter chips in sidebar
  function renderActiveFilters(){
    const chips = $(SELECTORS.chips);
    if(!chips) return;
    const sido = $(SELECTORS.sido)?.value || "";
    const gugun = $(SELECTORS.gugun)?.value || "";
    const dong = $(SELECTORS.dong)?.value || "";

    const parts = [];
    if(sido) parts.push(sido);
    if(gugun) parts.push(gugun);
    if(dong) parts.push(dong);
    const label = parts.length ? `📍 ${parts.join(" ")}` : "📍 전체 지역";

    chips.innerHTML = "";
    const span = document.createElement('span');
    span.className = "chip chip-location";
    span.textContent = label;
    chips.appendChild(span);
  }

  // Open modal safely without resetting user choice
  function openLocationModal(){
    if(opening) return; // guard against double-open race
    opening = true;
    try{
      ensureLocationSelectsState();
      const modal = $(SELECTORS.modal);
      if(modal) modal.classList.add('is-open');
    } finally {
      // Allow CSS transitions to complete before any other logic runs
      setTimeout(()=>{ opening = false; }, 200);
    }
  }

  function closeLocationModal(){
    const modal = $(SELECTORS.modal);
    if(modal) modal.classList.remove('is-open');
  }

  function resetLocationFilter(){
    const sido = $(SELECTORS.sido);
    const gugun = $(SELECTORS.gugun);
    const dong = $(SELECTORS.dong);
    if(sido) sido.value = "";
    if(gugun) gugun.value = "";
    if(dong) dong.value = "";
    ensureLocationSelectsState();
    renderActiveFilters();
  }

  function openSidebar(){
    const side = $(SELECTORS.sidebar);
    if(side) side.classList.add('is-open');
  }

  function applyLocationFilter(){
    // 1) close modal
    closeLocationModal();
    // 2) open sidebar and render chips
    openSidebar();
    renderActiveFilters();
    // 3) Trigger product reload (placeholder; integrate with your fetch)
    if(window.loadProductsByRegion){
      try{
        const s = $(SELECTORS.sido)?.value || "";
        const g = $(SELECTORS.gugun)?.value || "";
        const d = $(SELECTORS.dong)?.value || "";
        window.loadProductsByRegion({sido:s, gugun:g, dong:d});
      }catch(e){
        console.warn("loadProductsByRegion failed", e);
      }
    }
    // 4) toast
    if(window.toast) window.toast(`${($(SELECTORS.sido)?.value||"전체")} 지역 필터가 적용되었습니다.`);
  }

  function bindOnce(el, ev, fn){
    if(!el) return;
    const key = `__bound_${ev}`;
    if(el[key]) return;
    el.addEventListener(ev, fn);
    el[key] = true;
  }

  function initLocationFilter(){
    if(initialized) return;
    initialized = true;

    // initial population
    ensureLocationSelectsState();
    renderActiveFilters();

    // listeners
    bindOnce($(SELECTORS.openBtn), 'click', openLocationModal);
    bindOnce($(SELECTORS.applyBtn), 'click', applyLocationFilter);
    bindOnce($(SELECTORS.resetBtn), 'click', resetLocationFilter);

    bindOnce($(SELECTORS.sido), 'change', function(){
      populateGugun();
      // Keep dong enabled; just repopulate list
      populateDong();
    });

    bindOnce($(SELECTORS.gugun), 'change', function(){
      populateDong();
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') closeLocationModal();
    });
  }

  // Auto-init when DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initLocationFilter);
  }else{
    initLocationFilter();
  }

  // expose for debugging
  window.__LocationFilter = {
    initLocationFilter, openLocationModal, applyLocationFilter,
    resetLocationFilter, ensureLocationSelectsState
  };
})();
