<template>
  <DialogOverlay :open="open" padded @close="$emit('close')">
    <form class="panel panel-pad mx-auto w-full max-w-lg space-y-4" @submit.prevent="submit">
      <div><p class="text-xs font-semibold text-ink-500">設備</p><h2 class="mt-1 text-lg font-bold">更新狀態</h2></div>
      <div class="grid gap-2">
        <button v-if="currentStatus === 'pending'" type="button" class="menu-item" :class="{ 'button-toolbar--active': status === 'processing' }" @click="status = 'processing'">處理中</button>
        <template v-else-if="currentStatus === 'processing'">
          <button type="button" class="menu-item" :class="{ 'button-toolbar--active': status === 'completed' }" @click="status = 'completed'">已完成</button>
          <button type="button" class="menu-item" :class="{ 'button-toolbar--active': status === 'unable-to-handle' }" @click="status = 'unable-to-handle'">無法處理</button>
        </template>
      </div>
      <label v-if="terminal" class="block space-y-1.5"><span class="field-label">處理結果</span><textarea v-model="result" class="field min-h-32" maxlength="2000" placeholder="請說明處理結果" /></label>
      <p v-if="error" class="text-xs font-semibold text-error">{{ error }}</p>
      <div class="flex justify-end gap-2"><button type="button" class="button-secondary" @click="$emit('close')">取消</button><button class="button-primary" :disabled="busy || !status">確認</button></div>
    </form>
  </DialogOverlay>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import type { FacilityStatus } from '@/types';
const props = defineProps<{ open: boolean; currentStatus: FacilityStatus }>();
const emit = defineEmits<{ close: []; submit: [status: FacilityStatus, result: string] }>();
const status = ref<FacilityStatus | ''>(''); const result = ref(''); const error = ref(''); const busy = ref(false);
const terminal = computed(() => status.value === 'completed' || status.value === 'unable-to-handle');
watch(() => props.open, (open) => { if (open) { status.value = ''; result.value = ''; error.value = ''; } });
function submit() { if (!status.value) return; if (terminal.value && !result.value.trim()) { error.value = '請填寫處理結果。'; return; } emit('submit', status.value, result.value.trim()); }
</script>
