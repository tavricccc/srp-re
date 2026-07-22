<template>
  <div
    ref="editorRootRef"
    class="relative flex flex-col min-h-0 h-full space-y-2"
  >
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
        />

        <!-- Tab switchers (hidden on desktop if split screen is active) -->
        <template v-if="!split">
          <AppButton
            variant="toolbar"
            :active="!showPreview"
            @click="emit('update:showPreview', false)"
          >
            {{ t("markdown.edit") }}
          </AppButton>
          <AppButton
            variant="toolbar"
            :active="showPreview"
            @click="emit('update:showPreview', true)"
          >
            {{ t("markdown.preview") }}
          </AppButton>
        </template>
        <!-- On mobile, show switcher tabs even if split is true -->
        <template v-else>
          <AppButton
            variant="toolbar"
            class="md:hidden"
            :active="!showPreview"
            @click="emit('update:showPreview', false)"
          >
            {{ t("markdown.edit") }}
          </AppButton>
          <AppButton
            variant="toolbar"
            class="md:hidden"
            :active="showPreview"
            @click="emit('update:showPreview', true)"
          >
            {{ t("markdown.preview") }}
          </AppButton>
        </template>
      </div>
    </div>

    <!-- Layout container (Split screen desktop vs single column responsive fallback) -->
    <div
      v-if="split"
      class="hidden md:grid grid-cols-2 gap-6 flex-1 min-h-0 h-full relative"
    >
      <!-- Left Column: Rich Text Area -->
      <EditorSurface class="relative flex min-h-0 flex-col overflow-hidden">
        <!-- Formatting Toolbar -->
        <MarkdownToolbar @command="executeToolbarCommand">
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
          <EditorModeBar
            v-if="activeMode === 'table'"
            :label="t('markdown.tableMode')"
            :action-label="t('markdown.returnToText')"
            @action="exitTableMode"
          />
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="textareaDomId('desktop', index)"
                :ref="
                  (el) =>
                    setTextareaRef(block.id, el as HTMLTextAreaElement | null)
                "
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
      </EditorSurface>

      <!-- Right Column: Split Live Preview -->
      <EditorSurface class="flex min-h-0 flex-col overflow-y-auto p-4">
        <h3
          class="text-xs font-bold text-ink-500 dark:text-ink-400 mb-3 uppercase tracking-wider shrink-0"
        >
          {{ t("markdown.livePreview") }}
        </h3>
        <div class="flex-1 min-h-0">
          <MarkdownRenderer
            v-if="previewContent.trim()"
            :content="previewContent"
          />
          <span v-else class="text-sm italic text-ink-400">{{
            t("markdown.noPreview")
          }}</span>
        </div>
      </EditorSurface>
    </div>

    <!-- Mobile or fallback Single Column Layout -->
    <div
      v-else-if="!showPreview"
      class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
      :class="editorClass"
    >
      <!-- Formatting Toolbar -->
      <MarkdownToolbar @command="executeToolbarCommand">
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
        <EditorModeBar
          v-if="activeMode === 'table'"
          :label="t('markdown.tableMode')"
          :action-label="t('markdown.returnToText')"
          @action="exitTableMode"
        />
        <div
          v-if="activeMode === 'text'"
          class="min-h-56 w-full border-none bg-transparent p-3 flex-1 overflow-y-auto space-y-3"
        >
          <template v-for="(block, index) in textModeBlocks" :key="block.id">
            <textarea
              v-if="block.type === 'text'"
              :id="textareaDomId('single', index)"
              :ref="
                (el) =>
                  setTextareaRef(block.id, el as HTMLTextAreaElement | null)
              "
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
      <MarkdownRenderer
        v-if="previewContent.trim()"
        :content="previewContent"
      />
      <span v-else class="text-sm italic text-ink-400">{{
        t("markdown.noPreview")
      }}</span>
    </div>

    <!-- Responsive Fallback layout for split screen mobile view -->
    <div v-if="split" class="md:hidden flex flex-col flex-1 min-h-0">
      <div
        v-if="!showPreview"
        class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
        :class="editorClass"
      >
        <!-- Formatting Toolbar -->
        <MarkdownToolbar @command="executeToolbarCommand">
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
          <EditorModeBar
            v-if="activeMode === 'table'"
            :label="t('markdown.tableMode')"
            :action-label="t('markdown.returnToText')"
            @action="exitTableMode"
          />
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="textareaDomId('mobile', index)"
                :ref="
                  (el) =>
                    setTextareaRef(block.id, el as HTMLTextAreaElement | null)
                "
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
        <MarkdownRenderer
          v-if="previewContent.trim()"
          :content="previewContent"
        />
        <span v-else class="text-sm italic text-ink-400">{{
          t("markdown.noPreview")
        }}</span>
      </div>
    </div>

    <!-- Bottom counter/helper text row -->
    <div
      class="flex justify-between text-xs text-ink-500 dark:text-ink-400 shrink-0"
    >
      <span>{{ t(effectiveHelperText) }}</span>
      <CharacterCount
        :current="content.length"
        :max="maxLength"
        :warning-at="warningLength"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import AppButton from "@/components/ui/atoms/AppButton.vue";
import AppIcon from "@/components/ui/atoms/AppIcon.vue";
import CharacterCount from "@/components/ui/atoms/CharacterCount.vue";
import EditorSurface from "@/components/ui/molecules/EditorSurface.vue";
import EditorModeBar from '@/components/ui/molecules/EditorModeBar.vue';
import VisualTableEditor from "@/components/ui/organisms/VisualTableEditor.vue";
import MarkdownToolbar from "@/components/ui/molecules/MarkdownToolbar.vue";
import MarkdownImagePreviews from "@/components/ui/molecules/MarkdownImagePreviews.vue";
import MarkdownImageToolbarStatus from "@/components/ui/molecules/MarkdownImageToolbarStatus.vue";
import MarkdownTableBlockCard from "@/components/ui/molecules/MarkdownTableBlockCard.vue";
import TableGridPicker from "@/components/ui/molecules/TableGridPicker.vue";
import {
  useMarkdownImageEditor,
  type MarkdownEditorImage,
} from "@/composables/useMarkdownImageEditor";
import { useI18n } from "@/i18n";

export type { MarkdownEditorImage };

const props = withDefaults(
  defineProps<{
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
  }>(),
  {
    busyLabel: "comments.imageProcessing",
    disabled: false,
    editorClass: "",
    helperText: "markdown.editorHelp",
    maxImagesLabel: "",
    placeholder: "",
    previewClass: "",
    textareaClass: "",
    uploading: false,
    split: false,
  },
);
const { t } = useI18n();

const emit = defineEmits<{
  "image-picked": [event: Event];
  "remove-image": [key: string];
  "update:content": [content: string];
  "update:showPreview": [showPreview: boolean];
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
