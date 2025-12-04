import {
    BadgeColor,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    ContentRating,
    HomePageSectionsProviding,
    HomeSection,
    HomeSectionType,
    MangaProviding,
    PagedResults,
    PartialSourceManga,
    Request,
    Response,
    SearchRequest,
    SearchResultsProviding,
    SourceInfo,
    SourceIntents,
    SourceManga,
    TagSection
} from '@paperback/types'

import * as cheerio from 'cheerio'
import { createHomeSection, DefaultHomeSectionData, getFilterTagsBySection, getIncludedTagBySection, HomeSectionData } from './PoseidonScansHelpers'
import { AnyNode } from 'domhandler'
import { PoseidonScansParser } from './PoseidonScansParser'
import { StatusTypes } from './PoseidonScansInterfaces'

const DOMAIN = 'https://poseidon-scans.com'

export const PoseidonScansInfo: SourceInfo = {
    version: '0.0.1',
    name: 'PoseidonScans',
    description: `Extension that pulls webtoons from ${DOMAIN}`,
    author: 'MaksOuw',
    authorWebsite: 'http://github.com/MaksOuw',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'French',
            type: BadgeColor.GREY
        }
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED | SourceIntents.SETTINGS_UI
}

export class PoseidonScans implements ChapterProviding, HomePageSectionsProviding, MangaProviding {
    constructor() {
        this.configureSections()
    }

    configureSections(): void { return }

    manga_StatusTypes: StatusTypes = {
        ONGOING: 'en cours',
        COMPLETED: 'terminé',
        DROPPED: 'annulé',
        PAUSED: 'en pause'
    }

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}), ...{
                        'user-agent': await this.requestManager.getDefaultUserAgent(),
                        referer: `${this.baseUrl}/`, ...((request.url.includes('wordpress.com') || request.url.includes('wp.com')) && {
                            Accept: 'image/avif,image/webp,*/*'
                        }) // Used for images hosted on Wordpress blogs
                    }
                }

                request.url = request.url.replace(/^http:/, 'https:')

                return request
            },

            interceptResponse: async (response: Response): Promise<Response> => {
                if (response.headers.location) {
                    response.headers.location = response.headers.location.replace(/^http:/, 'https:')
                }
                return response
            }
        }
    })
    baseUrl: string = DOMAIN
    language = '🇫🇷'
    directoryPath = 'serie'
    parser = new PoseidonScansParser()
    
    homescreen_sections: Record<'highlighted_projects' | 'popular_today' | 'latest_update' | 'top_week_projects', HomeSectionData> = {
        'highlighted_projects': {
            ...DefaultHomeSectionData,
            section: createHomeSection('highlighted_projects', 'Projets mis en avant', false, HomeSectionType.featured),
            selectorFunc: ($: cheerio.CheerioAPI) => $('div', $('body > main > div > main > section:nth-child(4)')),
            titleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => $('h3', element).text(),
            subtitleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => undefined,
            getViewMoreItemsFunc: (page: string) => undefined,
            sortIndex: 1
        },
        'popular_today': {
            ...DefaultHomeSectionData,
            section: createHomeSection('popular_today', 'Populaire aujourd\'hui'),
            selectorFunc: ($: cheerio.CheerioAPI) => $('a.block', $('body > main > div > main > section.w-full.px-8.pt-8')),
            titleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => $('h3', element).text(),
            subtitleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => undefined,
            getViewMoreItemsFunc: (page: string) => undefined,
            sortIndex: 2
        },
        'latest_update': {
            ...DefaultHomeSectionData,
            section: createHomeSection('latest_update', 'Dernières sorties'),
            selectorFunc: ($: cheerio.CheerioAPI) => $('div.group/card', $('body > main > div > main > section:nth-child(6) > div > div.lg\:col-span-4')),
            titleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => $('h3', element).text(),
            subtitleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => undefined,
            getViewMoreItemsFunc: (page: string) => undefined,
            sortIndex: 3
        }
        /*'top_week_projects': {
            ...DefaultHomeSectionData,
            section: createHomeSection('top_week_projects', 'Top de la semaine'),
            selectorFunc: ($: cheerio.CheerioAPI) => $('div.embla__slide', $('body > main > div > main > section:nth-child(6) > div > div.lg\:col-span-2.mt-8.lg\:mt-0 > div')),
            titleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => $('h3', element).text(),
            subtitleSelectorFunc: ($: cheerio.CheerioAPI, element: cheerio.BasicAcceptedElems<AnyNode>) => undefined,
            getViewMoreItemsFunc: (page: string) => undefined,
            sortIndex: 4
        }*/
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${this.directoryPath}/${mangaId}/`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        return this.parser.parseChapterList($, mangaId, this)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${this.directoryPath}/${mangaId}/chapter/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${this.directoryPath}/${mangaId}/`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        return this.parser.parseMangaDetails($, mangaId, this)
    }

    getMangaShareUrl?(mangaId: string): string {
        return `${this.baseUrl}/${this.directoryPath}/${mangaId}/`
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}/`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        const promises: Promise<void>[] = []
        const sectionValues = Object.values(this.homescreen_sections).sort((n1, n2) => n1.sortIndex - n2.sortIndex)
        for (const section of sectionValues) {
            if (!section.enabled) {
                continue
            }
            // Let the app load empty sections
            sectionCallback(section.section)
        }

        for (const section of sectionValues) {
            if (!section.enabled) {
                continue
            }

            // eslint-disable-next-line no-async-promise-executor
            promises.push(new Promise(async () => {
                section.section.items = await this.parser.parseHomeSection($, section, this)
                sectionCallback(section.section)
            }))
        }

        // Make sure the function completes
        await Promise.all(promises)
    }

    getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        throw new Error('Method not implemented.')
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        throw new Error('Method not implemented.')

        /*const page: number = metadata?.page ?? 1
        
        const request = await this.constructSearchRequest(page, query)
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const results = await this.parser.parseSearchResults(response.data as string, this)

        const manga: PartialSourceManga[] = []
        for (const result of results) {
            let mangaId: string = result.mangaId

            manga.push(App.createPartialSourceManga({
                mangaId,
                image: result.image,
                title: result.title,
                subtitle: result.subtitle
            }))
        }

        metadata = !this.parser.isLastPage(response.data as string) ? { page: page + 1 } : undefined
        return App.createPagedResults({
            results: manga,
            metadata
        })*/
    }

    async getSearchTags?(): Promise<TagSection[]> {
        throw new Error('Method not implemented.')

        /*let request = App.createRequest({
            url: `${this.baseUrl}/${this.directoryPath}/`,
            method: 'GET'
        })

        let response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        request = App.createRequest({
            url: `${this.baseUrl}/api/genres`,
            method: 'GET'
        })

        response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)

        return this.parser.parseTags($, response.data ?? '')*/
    }

    async supportsTagExclusion(): Promise<boolean> {
        return false
    }

    checkResponseError(response: Response): void {
        const status = response.status
        switch (status) {
            case 403:
            case 503:
                throw new Error(`CLOUDFLARE BYPASS ERROR:\nPlease go to the homepage of <${this.baseUrl}> and press the cloud icon.`)
            case 404:
                throw new Error(`The requested page ${response.request.url} was not found!`)
        }
    }

    async constructSearchRequest(page: number, query: SearchRequest): Promise<any> {
        throw new Error('Method not implemented.')
        /*let urlBuilder: URLBuilder = new URLBuilder(this.baseUrl)
            .addPathComponent('api')
            .addPathComponent('front')
            .addPathComponent(this.directoryPath)

        urlBuilder = urlBuilder
            .addQueryParameter('query', query?.title ?? '')
            .addQueryParameter('page', page)
            .addQueryParameter('limit', '18')
            .addQueryParameter('genre', getFilterTagsBySection('genres', query?.includedTags, true))
            .addQueryParameter('status', getIncludedTagBySection('status', query?.includedTags))
            .addQueryParameter('type', getIncludedTagBySection('type', query?.includedTags))
            .addQueryParameter('sort', getIncludedTagBySection('sort', query?.includedTags))

        return App.createRequest({
            url: urlBuilder.buildUrl({ addTrailingSlash: false, includeUndefinedParameters: false }),
            method: 'GET'
        })*/
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.bypassPage || this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }
}