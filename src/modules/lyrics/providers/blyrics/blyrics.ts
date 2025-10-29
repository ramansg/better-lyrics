import type {Lyric, LyricPart, LyricsArray, LyricSourceResult, ProviderParameters} from "../shared";
import * as Constants from "@constants";
import {type X2jOptions, XMLParser} from 'fast-xml-parser';
import type {BackgroundSpanElement, TtmlRoot} from "@modules/lyrics/providers/blyrics/blyrics-types";
import {parseTime} from "@modules/lyrics/providers/lrcUtils";



/** Helper to safely convert a single item or an array into an array */
const toArray = <T>(data: T | T[] | undefined): T[] => {
    if (Array.isArray(data)) return data;
    if (data) return [data];
    return [];
};

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

    const options: X2jOptions = {
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        attributesGroupName: false,
        textNodeName: "#text",
        trimValues: false,
        removeNSPrefix: true,
        preserveOrder: true,
        allowBooleanAttributes: true,
        parseAttributeValue: false,
        parseTagValue: false
    };

    const parser = new XMLParser(options);

    let responseString: string = await response.json().then(json => json.ttml);
    console.log(responseString)

    // 2. Parse the XML into the "raw" object
    const rawObj = await parser.parse(responseString) as TtmlRoot;
    console.log(rawObj);

    let lyrics = [] as Lyric[];

    const tt = rawObj[0].tt
    const ttHead = tt.find(e => e.head)!.head!
    const ttBodyContainer = tt.find(e => e.body)!
    const ttBody = ttBodyContainer.body!;
    const ttMeta = ttBodyContainer[":@"];

    console.log("head", ttHead);
    console.log("body", ttBody);
    console.log("meta", ttMeta);

    const lines = ttBody.flatMap(e => e.div);
    console.log("lines", lines);

    let isWordSynced = false;

    lines.forEach((line, i) => {
        let meta = line[":@"]
        let text = "";
        let parts = [] as LyricPart[];

        line.p.forEach(p => {
            let isBackground = false;
            let localP: BackgroundSpanElement[] = [p];

            if (p[":@"] && p[":@"]["@_role"] === "x-bg") {
                // traverse one span in. This is a bg lyric
                isBackground = true;
                localP = p.span!;
            }

            for (let subParts of localP) {
                if (p["#text"]) {
                    text += p["#text"];
                    let lastPart = parts[parts.length - 1];
                    parts.push( {
                        startTimeMs: lastPart ? lastPart.startTimeMs + lastPart.durationMs : parseTime(meta["@_begin"]),
                        durationMs: 0,
                        words: p['#text'],
                        isBackground: false
                    });
                } else if (p.span) {
                    let spanText = subParts.span![0]["#text"]!;
                    let startTimeMs = parseTime(subParts[":@"]["@_begin"]);
                    let endTimeMs = parseTime(subParts[":@"]["@_end"]);

                    parts.push( {
                        startTimeMs,
                        durationMs: endTimeMs - startTimeMs,
                        isBackground,
                        words: spanText,
                    })

                    text += spanText;
                }
            }
        })

        let beginTimeMs = parseTime(meta["@_begin"]);
        let endTimeMs = parseTime(meta["@_end"]);

        if (parts.length <= 1) {
            parts = [];
        } else {
            isWordSynced = true;
        }

        lyrics.push({
            agent: meta["@_agent"],
            durationMs: endTimeMs - beginTimeMs,
            parts,
            startTimeMs: beginTimeMs,
            words: text
        })
    })

    console.log(lyrics);



    let result: LyricSourceResult = {
        cacheAllowed: true,
        language: ttMeta["@_lang"],
        lyrics: lyrics,
        musicVideoSynced: false,
        source: "biodu.dev",
        sourceHref: "https://boidu.dev/"
    }

    console.log("res", result)


    if (isWordSynced) {
        providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = result;
        providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;
    } else {
        providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;
        providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = result;
    }

    // providerParameters.sourceMap["bLyrics-richsynced"].lyricSourceResult = null;
    // providerParameters.sourceMap["bLyrics-synced"].lyricSourceResult = null;


    providerParameters.sourceMap["bLyrics-synced"].filled = true;
    providerParameters.sourceMap["bLyrics-richsynced"].filled = true;
}
