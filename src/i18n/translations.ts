import es from './es.json';
import en from './en.json';

export type PageKey = 'home' | 'preview' | 'blog' | 'contact';

export const PATHS = {
  es: {
    home: '/',
    preview: '/primeras-paginas',
    blog: '/blog',
    contact: '/contacto',
  },
  en: {
    home: '/en/',
    preview: '/en/preview',
    blog: '/en/blog',
    contact: '/en/contact',
  },
} as const satisfies Record<string, Record<PageKey, string>>;

export type Lang = keyof typeof PATHS;

interface MetaCopy {
  title: string;
  description: string;
  canonical: string;
}

interface HomeCopy {
  meta: MetaCopy;
  publisher: string;
  previewButton: string;
  videoAlt: string;
  announcementLinkLabel?: string;
  savvilyUrl?: string;
  amazonPaperLabel: string;
  amazonPaperUrl: string;
  amazonKindleLabel?: string;
  amazonKindleUrl?: string;
}

interface PreviewCopy {
  meta: MetaCopy;
  heading: string;
  iframeTitle: string;
  ctaLabel: string;
}

interface BlogCopy {
  meta: MetaCopy;
  heading: string;
  description: string;
  ctaLabel: string;
  languageNotice?: string;
  sectionHeading: string;
  sectionIntro: string;
  bullets: string[];
}

interface ContactCopy {
  meta: MetaCopy;
  heading: string;
  description: string;
  fields: {
    name: string;
    email: string;
    subject: string;
    message: string;
  };
  submit: string;
  otherHeading: string;
  links: {
    twitter: string;
    linkedin: string;
    personal: string;
  };
}

interface CommonCopy {
  siteName: string;
  bookDescription: string;
  bookEdition: string;
  ogLocale: string;
  htmlLang: string;
  footerRights: string;
  counterAlt: string;
  externalLinkLabel: string;
  externalLinkUrl: string;
  languageToggleLabel: string;
  hamburgerLabel: string;
  bookCoverImage: string;
}

interface NavCopy {
  home: string;
  preview: string;
  blog: string;
  contact: string;
}

export interface Translations {
  lang: Lang;
  nav: NavCopy;
  common: CommonCopy;
  home: HomeCopy;
  preview: PreviewCopy;
  blog: BlogCopy;
  contact: ContactCopy;
}

const buildTranslations = <T extends Record<Lang, Translations>>(data: T) => data;

const translationSources = buildTranslations({
  es,
  en,
});

export const translations: Record<Lang, Translations> = translationSources;

export const LANGUAGES = Object.keys(translations) as Lang[];

export const getTranslations = (lang: Lang): Translations => translations[lang];

export const getAlternateLang = (lang: Lang): Lang => {
  const others = LANGUAGES.filter((code) => code !== lang);
  return others[0] ?? lang;
};

export const getLanguagePaths = (page: PageKey) => ({
  es: PATHS.es[page],
  en: PATHS.en[page],
});
