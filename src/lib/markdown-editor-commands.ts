import type { AppIconName } from '@/components/ui/AppIcon.vue';

export type MarkdownEditorCommandId =
  | 'h1'
  | 'h2'
  | 'list'
  | 'numlist'
  | 'quote'
  | 'code'
  | 'table'
  | 'divider';

export interface MarkdownEditorCommand {
  id: MarkdownEditorCommandId;
  title: string;
  subtitle: string;
  iconName: AppIconName;
  keywords: string[];
  toolbarTitle: string;
}

export const MARKDOWN_EDITOR_COMMANDS: MarkdownEditorCommand[] = [
  {
    id: 'h1',
    title: 'markdown.headlineH1',
    subtitle: 'markdown.theMostEyeCatchingTitleStyle',
    iconName: 'h1',
    keywords: ['h1', 'title', '1', 'header', 'heading', 'da', 'biaoti'],
    toolbarTitle: 'markdown.headlineH1',
  },
  {
    id: 'h2',
    title: 'markdown.middleTitleH2',
    subtitle: 'markdown.chapterAndSubheadingStyles',
    iconName: 'h2',
    keywords: ['h2', 'title', '2', 'header', 'heading', 'zhong', 'biaoti'],
    toolbarTitle: 'markdown.middleTitleH2',
  },
  {
    id: 'list',
    title: 'markdown.itemList',
    subtitle: 'markdown.unorderedListOfItems',
    iconName: 'list',
    keywords: ['list', 'bullet', 'unordered', 'ul', 'xiangmu', 'qingdan'],
    toolbarTitle: 'markdown.itemList',
  },
  {
    id: 'numlist',
    title: 'markdown.numberedList',
    subtitle: 'markdown.orderedListItems',
    iconName: 'numlist',
    keywords: ['numlist', 'number', 'ordered', 'ol', 'ordered list', 'bianhao', 'qingdan'],
    toolbarTitle: 'markdown.numberedList',
  },
  {
    id: 'table',
    title: 'markdown.insertTable',
    subtitle: 'markdown.createANewDataTable',
    iconName: 'table',
    keywords: ['table', 'grid', 'excel', 'charu', 'biaoge'],
    toolbarTitle: 'markdown.insertTable',
  },
];
