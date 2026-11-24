import { getMetadata } from '../../scripts/aem.js';
import { createTag } from '../../scripts/shared.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  authoredHref, buildMarketSwitcher, fetchChrome, icon, LOGO_MARK, readLabels,
} from '../header/header.js';

const SOCIAL = [
  ['instagram', /instagram\.com$/],
  ['linkedin', /linkedin\.com$/],
  ['youtube', /(youtube\.com|youtu\.be)$/],
];

const isExternal = (a) => /^https?:/.test(authoredHref(a));
const isMarketLink = (a) => /^\/(?:[^/]+\/)*[a-z]{2}\/$/.test(authoredHref(a));
const isSocialLink = (a) => {
  try {
    const host = new URL(a.href).hostname.replace(/^www\./, '');
    return SOCIAL.some(([, re]) => re.test(host));
  } catch (e) {
    return false;
  }
};

function buildSocial(list) {
  if (!list) return null;
  const ul = createTag('ul', { class: 'footer-social' });
  list.querySelectorAll('a').forEach((a) => {
    let host = '';
    try { host = new URL(a.href).hostname.replace(/^www\./, ''); } catch (e) { /* noop */ }
    const [name] = SOCIAL.find(([, re]) => re.test(host)) || ['link'];
    const link = createTag('a', { href: a.href, rel: 'noopener', 'aria-label': a.textContent.trim() });
    link.innerHTML = icon(name);
    ul.append(createTag('li', {}, link));
  });
  return ul;
}

/** Copy of an authored paragraph with `{year}` replaced, keeping inline links and emphasis. */
function legalCopy(p) {
  const copy = createTag('p', { class: 'footer-legal-copy' });
  copy.append(...p.cloneNode(true).childNodes);
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    node.textContent = node.textContent.replace('{year}', new Date().getFullYear());
  }
  copy.querySelectorAll('a').forEach((a) => a.setAttribute('href', authoredHref(a)));
  return copy;
}

/** Plain list of authored links. */
function linkList(list, cls, label) {
  const ul = createTag('ul', { class: cls, 'aria-label': label });
  list.querySelectorAll('a').forEach((a) => ul.append(createTag('li', {}, createTag('a', { href: authoredHref(a) }, a.textContent.trim()))));
  return ul;
}

const iconName = (el) => [...(el?.classList || [])].find((c) => c.startsWith('icon-'))?.slice(5);
const isLogoLink = (a) => !!a.querySelector('.icon') && !a.textContent.trim();

/** A list of icon-only links (`:icon:` per link) becomes a row of logo images. */
function buildLogos(list, label) {
  const ul = createTag('ul', { class: 'footer-logos', 'aria-label': label });
  list.querySelectorAll('a').forEach((a) => {
    const name = iconName(a.querySelector('.icon'));
    const img = createTag('img', {
      src: `${window.hlx.codeBasePath}/icons/${name}.svg`, alt: a.title || name, loading: 'lazy', width: 52, height: 26,
    });
    const link = createTag('a', { href: authoredHref(a), class: `footer-logo footer-logo-${name}` }, img);
    ul.append(createTag('li', {}, link));
  });
  return ul;
}

/** Brand link: `:logo:` renders /icons/logo.svg, otherwise the logo mark plus the link text. */
function buildLegalBrand(brandLink) {
  const brand = createTag(brandLink ? 'a' : 'p', { class: 'footer-legal-brand' });
  if (brandLink) brand.setAttribute('href', authoredHref(brandLink));
  if (brandLink?.querySelector('.icon-logo')) {
    brand.append(createTag('img', {
      src: `${window.hlx.codeBasePath}/icons/logo.svg`, alt: brandLink.title || 'Home', loading: 'lazy', width: 153, height: 40,
    }));
    return brand;
  }
  brand.innerHTML = LOGO_MARK;
  brand.append(createTag('span', {}, brandLink?.textContent.trim() || 'Frescopa'));
  return brand;
}

/**
 * `footer-layout: legal`: logo + link row, then a bottom band with legal paragraphs and links.
 * Section 1: brand link (optional, its text is the wordmark; `:logo:` uses /icons/logo.svg) and
 * lists of links (two or more lists render as columns). A list of social profile links becomes
 * icons; a list of icon-only links (`:brand-x:`) becomes a logo row (then the brand is optional).
 * Next sections, in authored order: paragraphs (copyright, `{year}` is replaced) and lists
 * (stacked legal links; market links become the market switcher, social links icons).
 * The bottom band's background is `--color-footer-band` (transparent by default).
 * @param {Element} block
 * @param {HTMLElement[]} sections
 */
function decorateLegal(block, sections) {
  const [rowSec, ...restSecs] = sections;
  const labels = sections.reduce((all, sec) => ({ ...all, ...readLabels(sec) }), {});
  const inner = createTag('div', { class: 'footer-inner' });

  /* logo + link row */
  const row = createTag('div', { class: 'footer-legal-row' });
  const lists = [...(rowSec?.querySelectorAll('ul') || [])];
  const allLinks = (ul) => [...ul.querySelectorAll('a')];
  const logoList = lists.find((ul) => allLinks(ul).length && allLinks(ul).every(isLogoLink));
  const socialList = lists.find((ul) => allLinks(ul).length && allLinks(ul).every(isSocialLink));
  const linkLists = lists.filter((ul) => ul !== logoList && ul !== socialList);
  const brandLink = rowSec?.querySelector(':scope > p a, :scope > h2 a, :scope > h3 a');
  /* a logo list moves the brand and the logos to a row at the top of the band */
  const logoRow = logoList ? createTag('div', { class: 'footer-legal-logos' }) : null;
  if (logoRow && brandLink) logoRow.append(buildLegalBrand(brandLink));
  else if (!logoList) row.append(buildLegalBrand(brandLink));
  if (linkLists.length) {
    const cls = linkLists.length > 1 ? 'footer-legal-nav footer-legal-cols' : 'footer-legal-nav';
    const nav = createTag('nav', { class: cls, 'aria-label': labels['footer-nav'] || 'Footer' });
    linkLists.forEach((ul) => nav.append(linkList(ul, 'footer-legal-links')));
    row.append(nav);
  }
  if (socialList) row.append(buildSocial(socialList));
  if (logoRow) logoRow.append(buildLogos(logoList, labels['brands-nav'] || 'Brands'));
  inner.append(row);

  /* bottom band: paragraphs and lists in authored order */
  const band = createTag('div', { class: 'footer-legal-band' });
  const bandInner = createTag('div', { class: 'footer-inner' });
  const stacks = [];
  const extras = [];
  restSecs.forEach((sec) => {
    let copy = null;
    [...sec.children].forEach((el) => {
      if (el.matches('p')) {
        if (!copy) {
          copy = createTag('div', { class: 'footer-legal-text' });
          stacks.push(copy);
        }
        copy.append(legalCopy(el));
        return;
      }
      const list = el.matches('ul') ? el : null;
      if (!list) return;
      const links = [...list.querySelectorAll('a')];
      if (!links.length) return;
      if (links.every(isMarketLink)) {
        extras.push(buildMarketSwitcher(list, labels, 'footer-market'));
      } else if (links.every(isSocialLink)) {
        extras.push(buildSocial(list));
      } else {
        stacks.push(linkList(list, 'footer-legal-stack', labels['legal-nav'] || 'Legal'));
        copy = null;
      }
    });
  });
  if (logoRow) bandInner.append(logoRow);
  const texts = stacks.filter((el) => el.matches('.footer-legal-text'));
  const bottom = createTag('div', { class: 'footer-legal-bottom' }, [
    ...stacks.filter((el) => !texts.includes(el)), ...extras]);
  if (texts[0] === stacks[0]) {
    bandInner.append(...texts);
    if (bottom.children.length) bandInner.append(bottom);
  } else {
    if (bottom.children.length) bandInner.append(bottom);
    bandInner.append(...texts);
  }
  if (bandInner.children.length) band.append(bandInner);

  block.classList.add('surface-ink');
  block.append(inner);
  if (band.children.length) block.append(band);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const sections = await fetchChrome('footer');

  /* optional layout from page/site metadata, e.g. `footer-layout: legal` */
  const layout = getMetadata('footer-layout').trim().toLowerCase();
  if (layout) block.classList.add(`footer-layout-${layout}`);
  if (layout === 'legal') {
    block.textContent = '';
    decorateLegal(block, sections);
    return;
  }

  const [introSec, colsSec, bottomSec] = sections;
  const labels = readLabels(introSec);
  block.textContent = '';
  block.classList.add('surface-ink');

  const inner = createTag('div', { class: 'footer-inner' });
  const top = createTag('div', { class: 'footer-top' });

  /* brand statement + newsletter */
  const intro = createTag('div', { class: 'footer-intro' });
  const brand = createTag('p', { class: 'footer-brand' });
  brand.innerHTML = LOGO_MARK;
  const heading = introSec?.querySelector('h1, h2, h3, h4');
  if (heading) {
    const statement = createTag('p', { class: 'footer-statement' });
    statement.append(...heading.cloneNode(true).childNodes);
    intro.append(brand, statement);
  } else {
    intro.append(brand);
  }
  /* a link to a fragment (e.g. /fragments/newsletter) brings in its content, such as a form */
  const isFragmentLink = (a) => authoredHref(a).startsWith('/fragments/');
  introSec?.querySelectorAll(':scope > p').forEach((p) => {
    const link = p.querySelector('a');
    if (link && isFragmentLink(link)) {
      const slot = createTag('div', { class: 'footer-fragment' });
      intro.append(slot);
      loadFragment(authoredHref(link)).then((fragment) => {
        if (fragment) slot.append(...fragment.childNodes);
      });
      return;
    }
    intro.append(createTag('p', { class: 'footer-lede' }, p.textContent.trim()));
  });
  top.append(intro);

  /* link columns */
  if (colsSec) {
    const nav = createTag('nav', { class: 'footer-cols', 'aria-label': labels['footer-nav'] || 'Footer' });
    colsSec.querySelectorAll('h2, h3, h4').forEach((h) => {
      const list = h.nextElementSibling?.matches('ul') ? h.nextElementSibling : null;
      const col = createTag('div', { class: 'footer-col' }, createTag('h2', {}, h.textContent.trim()));
      if (list) {
        const ul = createTag('ul');
        list.querySelectorAll('a').forEach((a) => ul.append(createTag('li', {}, createTag('a', { href: authoredHref(a) }, a.textContent.trim()))));
        col.append(ul);
      }
      nav.append(col);
    });
    top.append(nav);
  }
  inner.append(top);

  /* bottom row: market, legal, copyright, social */
  const bottom = createTag('div', { class: 'footer-bottom' });
  if (bottomSec) {
    const lists = [...bottomSec.querySelectorAll('ul')];
    const marketList = lists.find((ul) => [...ul.querySelectorAll('a')].every(isMarketLink));
    const socialList = lists.find((ul) => [...ul.querySelectorAll('a')].every(isExternal));
    const legalList = lists.find((ul) => ul !== marketList && ul !== socialList);
    const market = buildMarketSwitcher(marketList, labels, 'footer-market');
    if (market) bottom.append(market);
    if (legalList) {
      const ul = createTag('ul', { class: 'footer-legal', 'aria-label': labels['legal-nav'] || 'Legal' });
      legalList.querySelectorAll('a').forEach((a) => ul.append(createTag('li', {}, createTag('a', { href: authoredHref(a) }, a.textContent.trim()))));
      bottom.append(ul);
    }
    bottomSec.querySelectorAll(':scope > p').forEach((p) => {
      bottom.append(createTag('p', { class: 'footer-copyright' }, p.textContent.trim().replace('{year}', new Date().getFullYear())));
    });
    const social = buildSocial(socialList);
    if (social) bottom.append(social);
  }
  inner.append(bottom);
  block.append(inner);
}
