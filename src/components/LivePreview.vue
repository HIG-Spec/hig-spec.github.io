<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { renderScene, type Background } from '../rendering/scene';
import { statePartner, togglePartner, clean, glassRecords } from '../data/store';
import type { Definition } from '../data/types';
const props = withDefaults(
  defineProps<{ component: Definition; compact?: boolean; recipe?: any }>(),
  { compact: false },
);
const emit = defineEmits<{ state: [Definition | null]; select: [Definition] }>();
const host = ref<HTMLElement>(),
  width = ref(680),
  background = ref<Background>('aurora'),
  refract = ref(true),
  phase = ref(0),
  active = ref(false);
const visible = ref(!props.compact);
let resizeFrame = 0;
let intersection: IntersectionObserver | undefined;
let observer: ResizeObserver | undefined, previous: Definition | undefined;
const html = computed(() =>
  !visible.value
    ? ''
    : renderScene(props.component, {
        width: width.value,
        height: props.compact ? 160 : 320,
        background: background.value,
        glass: refract.value,
        maxScale: props.compact ? 2 : 3.8,
        phase: phase.value,
        recipe: props.recipe,
      }),
);
const switchable = computed(
  () =>
    props.component.family === 'switches' &&
    !props.component.internal &&
    !/Disabled/.test(props.component.name),
);
const on = computed(() => /\/On\/|, On,/.test(props.component.name));
const effectCount = computed(() =>
  props.recipe
    ? Number(props.recipe.blurs?.some((b: any) => b.type === 4 && b.isEnabled))
    : glassRecords(props.component).length,
);
let activePointer: number | undefined;
function press(e: PointerEvent) {
  if (!switchable.value || e.button !== 0 || active.value) return;
  // Capture is optional: WebKit may already have retired this pointer ID.
  // Window-level release/cancel listeners keep an uncaptured drag from sticking.
  try {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
  }
  activePointer = e.pointerId;
  previous = props.component;
  active.value = true;
  const p = statePartner(previous, true);
  if (p) emit('state', p);
}
function finishPointer(e: PointerEvent) {
  if (e.pointerId === activePointer) release(e.type === 'pointercancel');
}
function cancelPress() {
  release(true);
}

function release(cancel = false) {
  if (!active.value || !previous) return;
  active.value = false;
  activePointer = undefined;
  emit('state', null);
  if (!cancel) {
    const partner = togglePartner(statePartner(previous, false) ?? previous);
    if (partner) emit('select', partner);
  }
  previous = undefined;
}
function keyboard(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const c = togglePartner(props.component);
    if (c) emit('select', c);
  }
}
onMounted(() => {
  window.addEventListener('pointerup', finishPointer);
  window.addEventListener('pointercancel', finishPointer);
  window.addEventListener('blur', cancelPress);
  observer = new ResizeObserver((entries) => {
    const nextWidth = Math.max(120, Math.floor(entries[0].contentRect.width));
    if (nextWidth === width.value) return;
    // The SVG depends on this width. Never resize it inside an observer delivery.
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      width.value = nextWidth;
    });
  });
  if (host.value) {
    observer.observe(host.value);
    if (props.compact) {
      intersection = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            visible.value = true;
            intersection?.disconnect();
          }
        },
        { rootMargin: '200px' },
      );
      intersection.observe(host.value);
    }
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', finishPointer);
  window.removeEventListener('pointercancel', finishPointer);
  window.removeEventListener('blur', cancelPress);
  cancelAnimationFrame(resizeFrame);
  observer?.disconnect();
  intersection?.disconnect();
});
</script>
<template>
  <div class="preview-shell" :class="{ compact }">
    <div v-if="!compact" class="preview-toolbar">
      <span class="eyebrow">WEB PREVIEW</span>
      <div class="choice">
        <button :class="{ selected: refract }" @click="refract = true">折射</button
        ><button :class="{ selected: !refract }" @click="refract = false">平面</button>
      </div>
      <select v-model="background" aria-label="预览背景">
        <option value="aurora">柔色背景</option>
        <option value="grid">对照网格</option>
        <option value="plain">纯色背景</option>
      </select>
    </div>
    <div ref="host" class="preview-canvas" :class="{ pressing: active }" v-html="html"></div>
    <button
      v-if="switchable && !compact"
      class="switch-hit"
      role="switch"
      :aria-checked="on"
      :aria-label="clean(component.name) + '，按住查看玻璃态'"
      @pointerdown="press"
      @pointerup="release(false)"
      @pointercancel="release(true)"
      @lostpointercapture="release(true)"
      @keydown="keyboard"
      title="按住查看玻璃态，松开切换"
    ></button>
    <div v-if="!compact" class="preview-caption">
      <span
        >{{ effectCount ? `${effectCount} 个玻璃图层` : '静态状态'
        }}<span v-if="switchable"> · 按住开关查看按压态</span></span
      ><label
        >背景位置
        <input
          type="range"
          min="-120"
          max="120"
          v-model.number="phase"
          aria-label="预览背景位置" /></label
      ><span class="muted">Web 近似预览</span>
    </div>
  </div>
</template>
