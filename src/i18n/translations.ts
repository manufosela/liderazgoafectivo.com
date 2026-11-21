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
  communityLabel: string;
  communityUrl: string;
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

interface AudiobookCopy {
  meta: MetaCopy;
  eyebrow: string;
  heading: string;
  intro: string;
  fields: {
    email: string;
    code: string;
  };
  codeHint: string;
  submit: string;
  submitting: string;
  errors: Record<'accessDenied' | 'tooManyAttempts' | 'unavailable' | 'network', string>;
  welcome: string;
  player: {
    chapters: string;
    expired: string;
    unavailable: string;
    resume: string;
    speed: string;
  };
}

/** The admin is its own site: before signing in nothing says what it manages. */
interface AdminCopy {
  title: string;
  sectionsLabel: string;
  sections: { audiobook: string };
  heading: string;
  signIn: string;
  signOut: string;
  createHeading: string;
  fields: {
    email: string;
    note: string;
  };
  noteHint: string;
  create: string;
  resultLabel: string;
  copy: string;
  listHeading: string;
  columns: Record<'id' | 'note' | 'date' | 'status' | 'actions', string>;
  cancel: string;
  /** Read by the panel script from the data attributes of the page. */
  panel: Record<
    | 'active' | 'revoked' | 'revoke' | 'notAdmin' | 'invalidInput' | 'notFound' | 'unavailable' | 'network'
    | 'signInFailed' | 'copied' | 'copyFailed' | 'share' | 'confirmRevoke' | 'configMissing',
    string
  >;
}

interface CommonCopy {
  siteName: string;
  bookDescription: string;
  bookEdition: string;
  ogLocale: string;
  htmlLang: string;
  footerRights: string;
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
  /** Spanish only: the audiobook is in Spanish and its page is private. */
  audiobook?: AudiobookCopy;
  /** Spanish only: the private admin of the audiobook codes. */
  admin?: AdminCopy;
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

export const getPageSetup = (lang: Lang, pageKey: PageKey) => {
  const translations = getTranslations(lang);
  const alternateLang = getAlternateLang(lang);
  const alternateTranslations = getTranslations(alternateLang);
  const esCanonical = lang === 'es'
    ? translations[pageKey].meta.canonical
    : alternateTranslations[pageKey].meta.canonical;
  return {
    lang,
    translations,
    title: translations[pageKey].meta.title,
    description: translations[pageKey].meta.description,
    canonicalUrl: translations[pageKey].meta.canonical,
    alternateUrls: {
      es: lang === 'es' ? translations[pageKey].meta.canonical : alternateTranslations[pageKey].meta.canonical,
      en: lang === 'en' ? translations[pageKey].meta.canonical : alternateTranslations[pageKey].meta.canonical,
      'x-default': esCanonical,
    },
    languageLinks: getLanguagePaths(pageKey),
    navigationPaths: PATHS[lang],
  };
};
