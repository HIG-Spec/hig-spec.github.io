<script setup lang="ts">
import { computed, ref } from 'vue';
import { database, platformName, clean } from '../data/store';
import { number } from '../specs/measurements';
import type { Platform } from '../data/types';
const platform = ref<Platform>('ios'),
  query = ref('');
const styles = computed(() =>
  database.value!.typography[platform.value].filter((s) =>
    (s.name + s.font).toLowerCase().includes(query.value.toLowerCase()),
  ),
);
</script>
<template>
  <article>
    <header class="page-heading">
      <div class="eyebrow">TYPOGRAPHY</div>
      <h1>字体与排版</h1>
      <p>字号、行高和字重的参考值。</p>
    </header>
    <div class="variant-bar">
      <div class="pills">
        <button
          v-for="p in ['ios', 'macos']"
          :key="p"
          :class="{ active: platform === p }"
          @click="platform = p as Platform"
        >
          {{ platformName(p) }}
        </button>
      </div>
      <input
        type="search"
        v-model="query"
        placeholder="Body、Headline…"
        aria-label="搜索文字样式"
      />
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>样式</th>
            <th>字体</th>
            <th>字号 / pt</th>
            <th>行高 / pt</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in styles" :key="s.id">
            <td>{{ clean(s.name) }}</td>
            <td class="mono">{{ s.font }}</td>
            <td>{{ number(s.size) }}</td>
            <td>
              {{ number(s.minLineHeight)
              }}{{ s.maxLineHeight !== s.minLineHeight ? ' – ' + number(s.maxLineHeight) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
