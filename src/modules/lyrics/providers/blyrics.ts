import type {Lyric, LyricPart, LyricsArray, LyricSourceResult, ProviderParameters} from "./shared";
import * as Constants from "@constants";
import {XMLParser} from 'fast-xml-parser';
import {parseTime} from "@modules/lyrics/providers/lrcUtils";

// --- 1. ORIGINAL TYPES (From fast-xml-parser output) ---
// These are necessary for the transformer's input.

export interface TimedElement {
    '@_begin': string;
    '@_end': string;
    '#text': string;
}

export interface BackgroundSpan {
    '@_ttm:role': 'x-bg';
    span: TimedElement | TimedElement[];
}

export type LyricSpan = TimedElement | BackgroundSpan;

export interface TranslationText {
    '@_for': string;
    '#text'?: string;
    span?: { '@_xmlns:ttm': string; '@_ttm:role': string; '@_xmlns': string; '#text': string; };
}

export interface TransliterationText {
    '@_for': string;
    '#text'?: string;
    span?: LyricSpan | LyricSpan[];
}

export interface LyricLine {
    '@_begin': string;
    '@_end': string;
    '@_itunes:key': string;
    '@_ttm:agent': string;
    '#text'?: string;
    span?: LyricSpan | LyricSpan[];
}

export interface LyricSection {
    '@_begin': string;
    '@_end': string;
    '@_itunes:songPart': string;
    p: LyricLine[];
}

export interface TtmlRoot {
    tt: {
        '@_xmlns': string;
        '@_xmlns:itunes': string;
        '@_xmlns:ttm': string;
        '@_itunes:timing': 'Line' | 'Word';
        '@_xml:lang': string;
        head: {
            metadata: {
                'ttm:agent': { '@_type': string; '@_xml:id': string; };
                iTunesMetadata: {
                    '@_xmlns'?: string;
                    '@_leadingSilence'?: string;
                    translations: {
                        translation: { '@_type': string; '@_xml:lang': string; text: TranslationText[]; };
                    };
                    songwriters: { songwriter: string[]; };
                    transliterations: { transliteration: { '@_xml:lang': string; text: TransliterationText[]; }; };
                };
            };
        };
        body: {
            '@_dur': string;
            div: LyricSection[];
        };
    };
}

/** A single, timed word (for 'Word' timing) */
export interface CleanWord {
    /** Start time of the word in milliseconds */
    begin: number;
    /** End time of the word in milliseconds */
    end: number;
    text: string;
    isBackground: boolean;
}

/** A single line of lyrics */
export interface CleanLine {
    key: string; // The 'L1', 'L2' etc.
    /** Start time of the line in milliseconds */
    begin: number;
    /** End time of the line in milliseconds */
    end: number;
    /** The full text of the line (only for 'Line' timing) */
    text?: string;
    /** An array of timed words (only for 'Word' timing) */
    words?: CleanWord[];
}

/** A section of the song (e.g., "Verse", "Chorus") */
export interface CleanSection {
    /** Start time of the section in milliseconds */
    begin: number;
    /** End time of the section in milliseconds */
    end: number;
    songPart: string;
    lines: CleanLine[];
}

/** The root object containing all processed lyric data */
export interface CleanTtml {
    timing: 'Line' | 'Word';
    lang: string;
    /** The total duration of the track in milliseconds */
    duration: number;
    songwriters: string[];
    /** A key-value map of line keys to their English translation (if available) */
    translations?: Record<string, string>;
    /** A key-value map of line keys to their transliteration (if available) */
    transliterations?: Record<string, string>;
    sections: CleanSection[];
}

// --- 3. TRANSFORMATION LOGIC ---

/** Helper to safely convert a single item or an array into an array */
const toArray = <T>(data: T | T[] | undefined): T[] => {
    if (Array.isArray(data)) return data;
    if (data) return [data];
    return [];
};

/** Helper function to map 'Word' timed spans to CleanWord[] */
function mapWords(spans: LyricSpan | LyricSpan[] | undefined): CleanWord[] {
    const cleanWords: CleanWord[] = [];

    toArray(spans).forEach(span => {
        // Case 1: It's a background vocal span
        if ('@_ttm:role' in span && span['@_ttm:role'] === 'x-bg') {
            toArray(span.span).forEach(bgSpan => {
                cleanWords.push({
                    begin: parseTime(bgSpan['@_begin']),
                    end: parseTime(bgSpan['@_end']),
                    text: bgSpan['#text'],
                    isBackground: true,
                });
            });
        }
        // Case 2: It's a normal word span
        else if ('#text' in span) {
            cleanWords.push({
                begin: parseTime(span['@_begin']),
                end: parseTime(span['@_end']),
                text: span['#text'],
                isBackground: false,
            });
        }
    });
    return cleanWords;
}

/**
 * Transforms the raw XML parser output into a clean, easy-to-use object.
 * @param rawRoot The raw object from fast-xml-parser
 * @returns A CleanTtml object
 */
export function transformTtml(rawRoot: TtmlRoot): CleanTtml {
    const tt = rawRoot.tt;
    const timing = tt['@_itunes:timing'];
    const metadata = tt.head.metadata.iTunesMetadata;

    // 1. Map Translations (optional)
    let translations: Record<string, string> | undefined = undefined;
    if (metadata.translations) {
        translations = {}; // Initialize if it exists
        toArray(metadata.translations.translation.text).forEach(item => {
            const key = item['@_for'];
            let text = item['#text'] || '';
            if (item.span && item.span['#text']) {
                text += ` ${item.span['#text']}`;
            }
            translations![key] = text.trim();
        });
    }

    // 2. Map Transliterations (optional)
    let transliterations: Record<string, string> | undefined = undefined;
    if (metadata.transliterations) {
        transliterations = {}; // Initialize if it exists
        toArray(metadata.transliterations.transliteration.text).forEach(item => {
            const key = item['@_for'];
            let text = '';
            if (item['#text']) { // 'Line' mode
                text = item['#text'];
            } else if (item.span) { // 'Word' mode
                text = toArray(item.span).map(span => {
                    if ('#text' in span) return span['#text'];
                    if ('@_ttm:role' in span && span['@_ttm:role'] === 'x-bg') {
                        return toArray(span.span).map(s => s['#text']).join('');
                    }
                    return '';
                }).join('');
            }
            transliterations![key] = text.replace(/\s+/g, ' ').trim();
        });
    }

    // 3. Map Lyric Sections and Lines from <body>
    const sections: CleanSection[] = toArray(tt.body.div).map(div => {
        const lines: CleanLine[] = toArray(div.p).map(p => {
            const line: CleanLine = {
                key: p['@_itunes:key'],
                begin: parseTime(p['@_begin']),
                end: parseTime(p['@_end']),
            };

            if (timing === 'Line') {
                line.text = p['#text'] || '';
            } else {
                line.words = mapWords(p.span);
            }
            return line;
        });

        return {
            begin: parseTime(div['@_begin']),
            end: parseTime(div['@_end']),
            songPart: div['@_itunes:songPart'],
            lines: lines,
        };
    });

    // 4. Assemble final clean object
    const cleanTtml: CleanTtml = {
        timing: timing,
        lang: tt['@_xml:lang'],
        duration: parseTime(tt.body['@_dur']),
        songwriters: toArray(metadata.songwriters.songwriter),
        sections: sections,
    };

    // Conditionally add optional properties
    if (translations) {
        cleanTtml.translations = translations;
    }
    if (transliterations) {
        cleanTtml.transliterations = transliterations;
    }

    return cleanTtml;
}

export default async function bLyrics(providerParameters: ProviderParameters): Promise<void> {
    // Fetch from the primary API if cache is empty or invalid
    const url = new URL(Constants.LYRICS_API_URL);
    url.searchParams.append("s", providerParameters.song);
    url.searchParams.append("a", providerParameters.artist);
    url.searchParams.append("d", String(providerParameters.duration));

    const response = await fetch(url.toString(), {
        signal: AbortSignal.any([providerParameters.signal, AbortSignal.timeout(10000)]),
    });

    if (!response.ok) {
        providerParameters.sourceMap["bLyrics-richsynced"].filled = true;
        providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;

        providerParameters.sourceMap["bLyrics-synced"].filled = true;
        providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;
    }

    const options = {
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        allowBooleanAttributes: true,
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true,
        processEntities: true,
    };
    const parser = new XMLParser(options);

    let responseString: string = await response.json().then(json => json.ttml);
    console.log(responseString)

    // 2. Parse the XML into the "raw" object
    const rawObj: TtmlRoot = parser.parse(responseString);
    console.log(rawObj);

    // 3. Transform the raw object into the "clean" object
    const ttml: CleanTtml = transformTtml(rawObj);
    console.log(ttml)

    // if (data.type === "word") {
    //     providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = result;
    //     providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;
    // } else if (data.type === "line") {
    //     providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;
    //     providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = result;
    // } else {
    //     providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;
    //     providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;
    // }

    providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;
    providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;


    providerParameters.sourceMap["bLyrics-synced"].filled = true;
    providerParameters.sourceMap["bLyrics-richsynced"].filled = true;
}
