<template>
  <div ref="editorRootRef" class="relative flex flex-col min-h-0 h-full space-y-2">
    <!-- Header row with label and tabs/image action -->
    <div class="flex items-center justify-between gap-3 shrink-0">
      <span :id="labelId" class="field-label">{{ t(label) }}</span>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          autocomplete="off"
          class="hidden"
          multiple
          :aria-label="t('markdown.selectImage')"
          @change="emit('image-picked', $event)"
        >
        
        <!-- Tab switchers (hidden on desktop if split screen is active) -->
        <template v-if="!split">
          <button
            type="button"
            :class="['button-toolbar', { 'button-toolbar--active': !showPreview }]"
            @click="emit('update:showPreview', false)"
          >
            {{ t('markdown.edit') }}
          </button>
          <button
            type="button"
            :class="['button-toolbar', { 'button-toolbar--active': showPreview }]"
            @click="emit('update:showPreview', true)"
          >
            {{ t('markdown.preview') }}
          </button>
        </template>
        <!-- On mobile, show switcher tabs even if split is true -->
        <template v-else>
          <button
            type="button"
            :class="['button-toolbar md:hidden', { 'button-toolbar--active': !showPreview }]"
            @click="emit('update:showPreview', false)"
          >
            {{ t('markdown.edit') }}
          </button>
          <button
            type="button"
            :class="['button-toolbar md:hidden', { 'button-toolbar--active': showPreview }]"
            @click="emit('update:showPreview', true)"
          >
            {{ t('markdown.preview') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Layout container (Split screen desktop vs single column responsive fallback) -->
    <div v-if="split" class="hidden md:grid grid-cols-2 gap-6 flex-1 min-h-0 h-full relative">
      <!-- Left Column: Rich Text Area -->
      <div class="flex flex-col min-h-0 border border-ink-200 dark:border-ink-800 rounded-xl bg-white dark:bg-ink-900 overflow-hidden relative">
        <!-- Formatting Toolbar -->
        <MarkdownToolbar
          @command="executeToolbarCommand"
        >
          <MarkdownImageToolbarStatus
            :busy-label="t(busyLabel)"
            :disabled="disabled || uploading || images.length >= maxImages"
            :image-count="images.length"
            :max-images="maxImages"
            :max-images-label="maxImagesLabel"
            :uploading="uploading"
            @pick-image="fileInputRef?.click()"
          />
        </MarkdownToolbar>

        <!-- Textarea input wrapper (relative so popover escapes toolbar overflow-x-auto) -->
        <div class="flex-1 min-h-0 relative flex flex-col">
          <!-- Image upload previews -->
          <MarkdownImagePreviews
            :images="images"
            @remove-image="emit('remove-image', $event)"
          />
          <div
            v-if="activeMode === 'table'"
            class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
          >
            <span>{{ t('markdown.tableMode') }}</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
              @click="exitTableMode"
            >
              <AppIcon name="edit" :size="3" />
              <span>{{ t('markdown.returnToText') }}</span>
            </button>
          </div>
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="textareaDomId('desktop', index)"
                :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
                :aria-labelledby="labelId"
                :value="block.content"
                :class="textBlockTextareaClass"
                class="w-full resize-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
                autocomplete="off"
                :maxlength="maxLength"
                :placeholder="t(placeholder)"
                :disabled="disabled || uploading"
                @focus="handleTextBlockFocus(block.id)"
                @input="onTextBlockInput(block.id, $event)"
                @keydown="onTextareaKeyDown"
                @compositionstart="handleCompositionStart"
                @compositionend="handleCompositionEnd(block.id, $event)"
                @select="handleTextareaCursorChange(block.id)"
                @click="handleTextareaCursorChange(block.id)"
                @keyup="handleTextareaCursorChange(block.id)"
              ></textarea>
              <MarkdownTableBlockCard
                v-else
                :columns="block.table.headers.length"
                :rows="block.table.rows.length + 1"
                @delete="deleteTableBlockFromCard(block.id)"
                @edit="switchToTableMode(block.id)"
              />
            </template>
          </div>
          <VisualTableEditor
            v-else
            :content="localContent"
            :selected-table-id="selectedTableId"
            class="flex-1 min-h-[180px] overflow-y-auto p-3"
            @update:content="localContent = $event"
            @exit-selected-table="exitTableMode"
          />

          <!-- Visual Table Picker (escapes toolbar clipping container) -->
          <TableGridPicker
            v-if="showTablePicker"
            ref="tablePickerRef"
            @select="createTable"
          />
        </div>
      </div>

      <!-- Right Column: Split Live Preview -->
      <div class="flex flex-col min-h-0 border border-ink-200 dark:border-ink-800 rounded-xl bg-white dark:bg-ink-900 p-4 overflow-y-auto">
        <h3 class="text-xs font-bold text-ink-400 dark:text-ink-500 mb-3 uppercase tracking-wider shrink-0">{{ t('markdown.livePreview') }}</h3>
        <div class="flex-1 min-h-0">
          <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
          <span v-else class="text-sm italic text-ink-400">{{ t('markdown.noPreview') }}</span>
        </div>
      </div>
    </div>

    <!-- Mobile or fallback Single Column Layout -->
    <div
      v-else-if="!showPreview"
      class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
      :class="editorClass"
    >
      <!-- Formatting Toolbar -->
      <MarkdownToolbar
        @command="executeToolbarCommand"
      >
        <MarkdownImageToolbarStatus
          :busy-label="t(busyLabel)"
          :disabled="disabled || uploading || images.length >= maxImages"
          :image-count="images.length"
          :max-images="maxImages"
          :max-images-label="maxImagesLabel"
          :uploading="uploading"
          @pick-image="fileInputRef?.click()"
        />
      </MarkdownToolbar>

      <!-- Image previews & Textarea Container -->
      <div class="flex-1 min-h-0 relative flex flex-col">
        <!-- Image previews -->
        <MarkdownImagePreviews
          :images="images"
          size="lg"
          @remove-image="emit('remove-image', $event)"
        />
        <div
          v-if="activeMode === 'table'"
          class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
        >
          <span>{{ t('markdown.tableMode') }}</span>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
            @click="exitTableMode"
          >
            <AppIcon name="edit" :size="3" />
            <span>{{ t('markdown.returnToText') }}</span>
          </button>
        </div>
        <div
          v-if="activeMode === 'text'"
          class="min-h-56 w-full border-none bg-transparent p-3 flex-1 overflow-y-auto space-y-3"
        >
          <template v-for="(block, index) in textModeBlocks" :key="block.id">
            <textarea
              v-if="block.type === 'text'"
              :id="textareaDomId('single', index)"
              :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
              :aria-labelledby="labelId"
              :value="block.content"
              :class="textBlockTextareaClass"
              class="w-full resize-none border-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
              autocomplete="off"
              :maxlength="maxLength"
              :placeholder="t(placeholder)"
              :disabled="disabled || uploading"
              @focus="handleTextBlockFocus(block.id)"
              @input="onTextBlockInput(block.id, $event)"
              @keydown="onTextareaKeyDown"
              @compositionstart="handleCompositionStart"
              @compositionend="handleCompositionEnd(block.id, $event)"
              @select="handleTextareaCursorChange(block.id)"
              @click="handleTextareaCursorChange(block.id)"
              @keyup="handleTextareaCursorChange(block.id)"
            ></textarea>
            <MarkdownTableBlockCard
              v-else
              :columns="block.table.headers.length"
              :rows="block.table.rows.length + 1"
              @delete="deleteTableBlockFromCard(block.id)"
              @edit="switchToTableMode(block.id)"
            />
          </template>
        </div>
        <VisualTableEditor
          v-else
          :content="localContent"
          :selected-table-id="selectedTableId"
          class="flex-1 min-h-[180px] overflow-y-auto p-3"
          @update:content="localContent = $event"
          @exit-selected-table="exitTableMode"
        />

        <!-- Visual Table Picker -->
        <TableGridPicker
          v-if="showTablePicker"
          ref="tablePickerRef"
          @select="createTable"
        />
      </div>
    </div>

    <!-- Mobile or fallback Single Column Preview -->
    <div
      v-else
      class="field min-h-56 max-h-[500px] overflow-y-auto border border-ink-200 bg-white font-sans dark:border-ink-700 dark:bg-ink-900 flex-1"
      :class="previewClass"
    >
      <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
      <span v-else class="text-sm italic text-ink-400">{{ t('markdown.noPreview') }}</span>
    </div>

    <!-- Responsive Fallback layout for split screen mobile view -->
    <div
      v-if="split"
      class="md:hidden flex flex-col flex-1 min-h-0"
    >
      <div
        v-if="!showPreview"
        class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
        :class="editorClass"
      >
        <!-- Formatting Toolbar -->
        <MarkdownToolbar
          @command="executeToolbarCommand"
        >
          <MarkdownImageToolbarStatus
            :busy-label="t(busyLabel)"
            :disabled="disabled || uploading || images.length >= maxImages"
            :image-count="images.length"
            :max-images="maxImages"
            :max-images-label="maxImagesLabel"
            :uploading="uploading"
            @pick-image="fileInputRef?.click()"
          />
        </MarkdownToolbar>

        <!-- Textarea input container -->
        <div class="flex-1 min-h-0 relative flex flex-col">
          <!-- Image upload previews -->
          <MarkdownImagePreviews
            :images="images"
            @remove-image="emit('remove-image', $event)"
          />
          <div
            v-if="activeMode === 'table'"
            class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
          >
            <span>{{ t('markdown.tableMode') }}</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
              @click="exitTableMode"
            >
              <AppIcon name="edit" :size="3" />
              <span>{{ t('markdown.returnToText') }}</span>
            </button>
          </div>
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="textareaDomId('mobile', index)"
                :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
                :aria-labelledby="labelId"
                :value="block.content"
                :class="textBlockTextareaClass"
                class="w-full resize-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
                autocomplete="off"
                :maxlength="maxLength"
                :placeholder="t(placeholder)"
                :disabled="disabled || uploading"
                @focus="handleTextBlockFocus(block.id)"
                @input="onTextBlockInput(block.id, $event)"
                @keydown="onTextareaKeyDown"
                @compositionstart="handleCompositionStart"
                @compositionend="handleCompositionEnd(block.id, $event)"
                @select="handleTextareaCursorChange(block.id)"
                @click="handleTextareaCursorChange(block.id)"
                @keyup="handleTextareaCursorChange(block.id)"
              ></textarea>
              <MarkdownTableBlockCard
                v-else
                :columns="block.table.headers.length"
                :rows="block.table.rows.length + 1"
                @delete="deleteTableBlockFromCard(block.id)"
                @edit="switchToTableMode(block.id)"
              />
            </template>
          </div>
          <VisualTableEditor
            v-else
            :content="localContent"
            :selected-table-id="selectedTableId"
            class="flex-1 min-h-[180px] overflow-y-auto p-3"
            @update:content="localContent = $event"
            @exit-selected-table="exitTableMode"
          />

          <!-- Visual Table Picker -->
          <TableGridPicker
            v-if="showTablePicker"
            ref="tablePickerRef"
            @select="createTable"
          />
        </div>
      </div>

      <div
        v-else
        class="field min-h-56 max-h-[500px] overflow-y-auto border border-ink-200 bg-white font-sans dark:border-ink-700 dark:bg-ink-900 flex-1"
        :class="previewClass"
      >
        <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
        <span v-else class="text-sm italic text-ink-400">{{ t('markdown.noPreview') }}</span>
      </div>
    </div>

    <!-- Bottom counter/helper text row -->
    <div class="flex justify-between text-xs text-ink-500 dark:text-ink-400 shrink-0">
      <span>{{ t(effectiveHelperText) }}</span>
      <span class="font-medium" :class="{ 'text-error': content.length > warningLength }">
        {{ content.length }} / {{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import VisualTableEditor from './VisualTableEditor.vue';
import MarkdownToolbar from './MarkdownToolbar.vue';
import MarkdownImagePreviews from './MarkdownImagePreviews.vue';
import MarkdownImageToolbarStatus from './MarkdownImageToolbarStatus.vue';
import MarkdownTableBlockCard from './MarkdownTableBlockCard.vue';
import TableGridPicker from './TableGridPicker.vue';
import {
  useMarkdownImageEditor,
  type MarkdownEditorImage,
} from '@/composables/useMarkdownImageEditor';
import { useI18n } from '@/i18n';

export type { MarkdownEditorImage };

const props = withDefaults(defineProps<{
  busyLabel?: string;
  content: string;
  disabled?: boolean;
  editorClass?: string;
  helperText?: string;
  images: MarkdownEditorImage[];
  label: string;
  maxImages: number;
  maxImagesLabel?: string;
  maxLength: number;
  placeholder?: string;
  previewClass?: string;
  previewContent: string;
  showPreview: boolean;
  textareaClass?: string;
  textareaId: string;
  uploading?: boolean;
  warningLength: number;
  split?: boolean;
}>(), {
  busyLabel: 'comments.imageProcessing',
  disabled: false,
  editorClass: '',
  helperText: 'markdown.youCanEnterTextOrAddImagesAndUseTheToolbarToInsertFormats',
  maxImagesLabel: '',
  placeholder: '',
  previewClass: '',
  textareaClass: '',
  uploading: false,
  split: false,
});
const { t } = useI18n();

const emit = defineEmits<{
  'image-picked': [event: Event];
  'remove-image': [key: string];
  'update:content': [content: string];
  'update:showPreview': [showPreview: boolean];
}>();

const {
  fileInputRef,
  editorRootRef,
  tablePickerRef,
  localContent,
  labelId,
  activeMode,
  hasTables,
  textModeBlocks,
  selectedTableId,
  showTablePicker,
  effectiveHelperText,
  textBlockTextareaClass,
  textareaDomId,
  setTextareaRef,
  executeToolbarCommand,
  onTextBlockInput,
  handleCompositionStart,
  handleCompositionEnd,
  onTextareaKeyDown,
  createTable,
  handleTextareaCursorChange,
  handleTextBlockFocus,
  deleteTableBlockFromCard,
  switchToTableMode,
  exitTableMode,
} = useMarkdownImageEditor(props, emit);
</script>
<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
