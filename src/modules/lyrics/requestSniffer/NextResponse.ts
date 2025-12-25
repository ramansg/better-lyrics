export interface NextResponse {
    readonly responseContext:       ResponseContext;
    readonly contents:              Contents;
    readonly currentVideoEndpoint?: CurrentVideoEndpointClass;
    readonly trackingParams:        string;
    readonly playerOverlays?:       PlayerOverlays;
    readonly videoReporting?:       VideoReporting;
    readonly queueContextParams:    string;
    readonly continuationContents?: ContinuationContents;
}

export interface Contents {
    readonly singleColumnMusicWatchNextResultsRenderer: SingleColumnMusicWatchNextResultsRenderer;
}

export interface SingleColumnMusicWatchNextResultsRenderer {
    readonly tabbedRenderer: TabbedRenderer;
}

export interface TabbedRenderer {
    readonly watchNextTabbedResultsRenderer: WatchNextTabbedResultsRenderer;
}

export interface WatchNextTabbedResultsRenderer {
    readonly tabs: Tab[];
}

export interface Tab {
    readonly tabRenderer: TabRenderer;
}

export interface TabRenderer {
    readonly title:          TitleEnum;
    readonly content?:       TabRendererContent;
    readonly trackingParams: string;
    readonly endpoint?:      Endpoint;
    readonly unselectable?:  boolean;
}

export interface TabRendererContent {
    readonly musicQueueRenderer: MusicQueueRenderer;
}

export interface MusicQueueRenderer {
    readonly hack:                boolean;
    readonly content?:            MusicQueueRendererContent;
    readonly header?:             Header;
    readonly subHeaderChipCloud?: SubHeaderChipCloud;
}

export interface MusicQueueRendererContent {
    readonly playlistPanelRenderer: PlaylistPanelRenderer;
}

export interface PlaylistPanelRenderer {
    readonly contents:            PlaylistPanelRendererContent[];
    readonly playlistId?:         PlaylistID;
    readonly isInfinite:          boolean;
    readonly continuations?:      Continuation[];
    readonly trackingParams:      string;
    readonly numItemsToShow?:     number;
    readonly shuffleToggleButton: PlaylistPanelRendererShuffleToggleButton;
}

export interface PlaylistPanelRendererContent {
    readonly playlistPanelVideoWrapperRenderer?: PurplePlaylistPanelVideoWrapperRenderer;
    readonly playlistPanelVideoRenderer?:        ContentPlaylistPanelVideoRenderer;
    readonly automixPreviewVideoRenderer?:       AutomixPreviewVideoRenderer;
}

export interface AutomixPreviewVideoRenderer {
    readonly content: AutomixPreviewVideoRendererContent;
}

export interface AutomixPreviewVideoRendererContent {
    readonly automixPlaylistVideoRenderer: AutomixPlaylistVideoRenderer;
}

export interface AutomixPlaylistVideoRenderer {
    readonly navigationEndpoint: DefaultServiceEndpointClass;
    readonly trackingParams:     string;
    readonly automixMode:        string;
}

export interface DefaultServiceEndpointClass {
    readonly clickTrackingParams:   string;
    readonly watchPlaylistEndpoint: WatchPlaylistEndpoint;
}

export interface WatchPlaylistEndpoint {
    readonly playlistId: PlaylistID;
    readonly params:     string;
}

export type PlaylistID = "RDAMVMwXTJosqjxtA" | "RDAMVMbatpz8tBk0A" | "RDAMVMNsY-9MCOIAQ" | "RDAMVM27sJqXZM8iI" | "RDAMVML9JhkhA5rVM" | "RDAMVMJ6B13QxOEkc";

export interface ContentPlaylistPanelVideoRenderer {
    readonly title:                   TitleClass;
    readonly longBylineText:          LongBylineText;
    readonly thumbnail:               ThumbnailDetailsClass;
    readonly lengthText:              LengthText;
    readonly selected:                boolean;
    readonly navigationEndpoint:      CurrentVideoEndpointClass;
    readonly videoId:                 string;
    readonly shortBylineText:         TitleClass;
    readonly trackingParams:          string;
    readonly menu:                    PurpleMenu;
    readonly playlistSetVideoId?:     string;
    readonly canReorder:              boolean;
    readonly playlistEditParams:      PlaylistEditParams;
    readonly queueNavigationEndpoint: PurpleQueueNavigationEndpoint;
    readonly badges?:                 Badge[];
}

export interface Badge {
    readonly musicInlineBadgeRenderer: MusicInlineBadgeRenderer;
}

export interface MusicInlineBadgeRenderer {
    readonly trackingParams:    string;
    readonly icon:              Icon;
    readonly accessibilityData: Accessibility;
}

export interface Accessibility {
    readonly accessibilityData: AccessibilityData;
}

export interface AccessibilityData {
    readonly label: string;
}

export interface Icon {
    readonly iconType: IconType;
}

export type IconType = "MUSIC_EXPLICIT_BADGE" | "MIX" | "ADD_TO_PLAYLIST" | "ALBUM" | "ARTIST" | "PEOPLE_GROUP" | "SHARE" | "QUEUE_PLAY_NEXT" | "ADD_TO_REMOTE_QUEUE" | "REMOVE" | "FLAG" | "DISMISS_QUEUE" | "BOOKMARK_BORDER" | "FAVORITE" | "KEEP" | "BOOKMARK" | "UNFAVORITE" | "KEEP_OFF" | "MUSIC_SHUFFLE";

export interface LengthText {
    readonly runs:          LengthTextRun[];
    readonly accessibility: Accessibility;
}

export interface LengthTextRun {
    readonly text: string;
}

export interface LongBylineText {
    readonly runs: PurpleRun[];
}

export interface PurpleRun {
    readonly text:                string;
    readonly navigationEndpoint?: Endpoint;
}

export interface Endpoint {
    readonly clickTrackingParams: string;
    readonly browseEndpoint:      BrowseEndpoint;
}

export interface BrowseEndpoint {
    readonly browseId:                              string;
    readonly browseEndpointContextSupportedConfigs: BrowseEndpointContextSupportedConfigs;
}

export interface BrowseEndpointContextSupportedConfigs {
    readonly browseEndpointContextMusicConfig: BrowseEndpointContextMusicConfig;
}

export interface BrowseEndpointContextMusicConfig {
    readonly pageType: PageType;
}

export type PageType = "MUSIC_PAGE_TYPE_ARTIST" | "MUSIC_PAGE_TYPE_ALBUM" | "MUSIC_PAGE_TYPE_TRACK_CREDITS" | "MUSIC_PAGE_TYPE_TRACK_LYRICS" | "MUSIC_PAGE_TYPE_TRACK_RELATED";

export interface PurpleMenu {
    readonly menuRenderer: PurpleMenuRenderer;
}

export interface PurpleMenuRenderer {
    readonly items:          PurpleItem[];
    readonly trackingParams: string;
    readonly accessibility:  Accessibility;
}

export interface PurpleItem {
    readonly menuNavigationItemRenderer?:      MenuItemRenderer;
    readonly menuServiceItemRenderer?:         MenuItemRenderer;
    readonly toggleMenuServiceItemRenderer?:   PurpleToggleMenuServiceItemRenderer;
    readonly menuServiceItemDownloadRenderer?: MenuServiceItemDownloadRenderer;
}

export interface MenuItemRenderer {
    readonly text:                TitleClass;
    readonly icon:                Icon;
    readonly navigationEndpoint?: MenuNavigationItemRendererNavigationEndpoint;
    readonly trackingParams:      string;
    readonly serviceEndpoint?:    MenuNavigationItemRendererServiceEndpoint;
}

export interface MenuNavigationItemRendererNavigationEndpoint {
    readonly clickTrackingParams:    string;
    readonly watchEndpoint?:         PurpleWatchEndpoint;
    readonly addToPlaylistEndpoint?: Target;
    readonly browseEndpoint?:        BrowseEndpoint;
    readonly shareEntityEndpoint?:   ShareEntityEndpoint;
}

export interface Target {
    readonly videoId: string;
}

export interface ShareEntityEndpoint {
    readonly serializedShareEntity: string;
    readonly sharePanelType:        SharePanelType;
}

export type SharePanelType = "SHARE_PANEL_TYPE_UNIFIED_SHARE_PANEL";

export interface PurpleWatchEndpoint {
    readonly videoId:                            string;
    readonly playlistId:                         string;
    readonly params:                             WatchEndpointParams;
    readonly loggingContext:                     LoggingContext;
    readonly watchEndpointMusicSupportedConfigs: PurpleWatchEndpointMusicSupportedConfigs;
    readonly playerParams?:                      PlayerParams;
}

export interface LoggingContext {
    readonly vssLoggingContext: VssLoggingContext;
}

export interface VssLoggingContext {
    readonly serializedContextData: string;
}

export type WatchEndpointParams = "wAEB";

export type PlayerParams = "0gcJCZoAzrrq_1rT";

export interface PurpleWatchEndpointMusicSupportedConfigs {
    readonly watchEndpointMusicConfig: PurpleWatchEndpointMusicConfig;
}

export interface PurpleWatchEndpointMusicConfig {
    readonly musicVideoType: MusicVideoType;
}

export type MusicVideoType = "MUSIC_VIDEO_TYPE_ATV" | "MUSIC_VIDEO_TYPE_OMV";

export interface MenuNavigationItemRendererServiceEndpoint {
    readonly clickTrackingParams:      string;
    readonly queueAddEndpoint?:        ServiceEndpointQueueAddEndpoint;
    readonly removeFromQueueEndpoint?: RemoveFromQueueEndpoint;
    readonly getReportFormEndpoint?:   GetReportFormEndpoint;
    readonly deletePlaylistEndpoint?:  DeletePlaylistEndpoint;
}

export interface DeletePlaylistEndpoint {
    readonly playlistId: BackingQueuePlaylistIDEnum;
    readonly command:    DeletePlaylistEndpointCommand;
}

export interface DeletePlaylistEndpointCommand {
    readonly clickTrackingParams: string;
    readonly dismissQueueCommand: Command;
}

export interface Command {
}

export type BackingQueuePlaylistIDEnum = "QPouIihOZraM01NZeAGdMaSsZxhk7G3Dtxg" | "QPJNlFK9UPlT0sI9EmxbJXPFRygQF5spTl2" | "QPYoTnDkNDGA3HBqiTOTyQbzdzIclmYr2h4" | "QPO0-QUTGHqTQ5sCf4WJnbfKctmSlLh5dLY" | "QPERuv_YoEcjCt1owz7tv_HzpMkr1PpbPRA" | "QPVqkcFuJHZtbT3FzPA9dHrnKTuseOKEefz";

export interface GetReportFormEndpoint {
    readonly params: string;
}

export interface ServiceEndpointQueueAddEndpoint {
    readonly queueTarget:         PurpleQueueTarget;
    readonly queueInsertPosition: QueueInsertPosition;
    readonly commands:            CommandElement[];
}

export interface CommandElement {
    readonly clickTrackingParams: string;
    readonly addToToastAction:    AddToToastAction;
}

export interface AddToToastAction {
    readonly item: AddToToastActionItem;
}

export interface AddToToastActionItem {
    readonly notificationTextRenderer: NotificationTextRenderer;
}

export interface NotificationTextRenderer {
    readonly successResponseText: TitleClass;
    readonly trackingParams:      string;
}

export interface TitleClass {
    readonly runs: LengthTextRun[];
}

export type QueueInsertPosition = "INSERT_AFTER_CURRENT_VIDEO" | "INSERT_AT_END";

export interface PurpleQueueTarget {
    readonly videoId:                 string;
    readonly onEmptyQueue:            OnEmptyQueue;
    readonly backingQueuePlaylistId?: BackingQueuePlaylistIDEnum;
}

export interface OnEmptyQueue {
    readonly clickTrackingParams: string;
    readonly watchEndpoint:       Target;
}

export interface RemoveFromQueueEndpoint {
    readonly videoId:  string;
    readonly commands: CommandElement[];
}

export interface MenuServiceItemDownloadRenderer {
    readonly serviceEndpoint: MenuServiceItemDownloadRendererServiceEndpoint;
    readonly trackingParams:  string;
}

export interface MenuServiceItemDownloadRendererServiceEndpoint {
    readonly clickTrackingParams:  string;
    readonly offlineVideoEndpoint: OfflineVideoEndpoint;
}

export interface OfflineVideoEndpoint {
    readonly videoId:      string;
    readonly onAddCommand: OnAddCommand;
}

export interface OnAddCommand {
    readonly clickTrackingParams:      string;
    readonly getDownloadActionCommand: GetDownloadActionCommand;
}

export interface GetDownloadActionCommand {
    readonly videoId: string;
    readonly params:  GetDownloadActionCommandParams;
}

export type GetDownloadActionCommandParams = "CAI%3D";

export interface PurpleToggleMenuServiceItemRenderer {
    readonly defaultText:            TitleClass;
    readonly defaultIcon:            Icon;
    readonly defaultServiceEndpoint: PurpleServiceEndpoint;
    readonly toggledText:            TitleClass;
    readonly toggledIcon:            Icon;
    readonly toggledServiceEndpoint: PurpleServiceEndpoint;
    readonly trackingParams:         string;
}

export interface PurpleServiceEndpoint {
    readonly clickTrackingParams: string;
    readonly feedbackEndpoint?:   FeedbackEndpoint;
    readonly likeEndpoint?:       LikeEndpoint;
}

export interface FeedbackEndpoint {
    readonly feedbackToken: string;
}

export interface LikeEndpoint {
    readonly status:            Status;
    readonly target:            Target;
    readonly actions?:          LikeEndpointAction[];
    readonly likeParams?:       LikeParams;
    readonly removeLikeParams?: LikeParams;
    readonly dislikeParams?:    LikeParams;
}

export interface LikeEndpointAction {
    readonly clickTrackingParams:             string;
    readonly musicLibraryStatusUpdateCommand: MusicLibraryStatusUpdateCommand;
}

export interface MusicLibraryStatusUpdateCommand {
    readonly libraryStatus:             LibraryStatus;
    readonly addToLibraryFeedbackToken: string;
}

export type LibraryStatus = "MUSIC_LIBRARY_STATUS_IN_LIBRARY";

export type LikeParams = "OAI%3D";

export type Status = "LIKE" | "INDIFFERENT" | "DISLIKE";

export interface CurrentVideoEndpointClass {
    readonly clickTrackingParams: string;
    readonly watchEndpoint:       CurrentVideoEndpointWatchEndpoint;
}

export interface CurrentVideoEndpointWatchEndpoint {
    readonly videoId:                             string;
    readonly playlistId?:                         PlaylistID;
    readonly index?:                              number;
    readonly params?:                             string;
    readonly playerParams:                        string;
    readonly playlistSetVideoId?:                 string;
    readonly loggingContext?:                     LoggingContext;
    readonly watchEndpointMusicSupportedConfigs?: FluffyWatchEndpointMusicSupportedConfigs;
    readonly ustreamerConfig?:                    string;
}

export interface FluffyWatchEndpointMusicSupportedConfigs {
    readonly watchEndpointMusicConfig: FluffyWatchEndpointMusicConfig;
}

export interface FluffyWatchEndpointMusicConfig {
    readonly hasPersistentPlaylistPanel: boolean;
    readonly musicVideoType:             MusicVideoType;
}

export type PlaylistEditParams = "SiNRUG91SWloT1pyYU0wMU5aZUFHZE1hU3NaeGhrN0czRHR4Zw%3D%3D" | "SiNRUEpObEZLOVVQbFQwc0k5RW14YkpYUEZSeWdRRjVzcFRsMg%3D%3D" | "SiNRUFlvVG5Ea05ER0EzSEJxaVRPVHlRYnpkekljbG1ZcjJoNA%3D%3D" | "SiNRUE8wLVFVVEdIcVRRNXNDZjRXSm5iZktjdG1TbExoNWRMWQ%3D%3D" | "SiNRUEVSdXZfWW9FY2pDdDFvd3o3dHZfSHpwTWtyMVBwYlBSQQ%3D%3D" | "SiNRUFZxa2NGdUpIWnRiVDNGelBBOWRIcm5LVHVzZU9LRWVmeg%3D%3D";

export interface PurpleQueueNavigationEndpoint {
    readonly clickTrackingParams: string;
    readonly queueAddEndpoint:    PurpleQueueAddEndpoint;
}

export interface PurpleQueueAddEndpoint {
    readonly queueTarget:         FluffyQueueTarget;
    readonly queueInsertPosition: QueueInsertPosition;
    readonly params:              QueueAddEndpointParams;
}

export type QueueAddEndpointParams = "Q0FJJTNE";

export interface FluffyQueueTarget {
    readonly videoId:                string;
    readonly backingQueuePlaylistId: BackingQueuePlaylistIDEnum;
}

export interface ThumbnailDetailsClass {
    readonly thumbnails: ThumbnailElement[];
}

export interface ThumbnailElement {
    readonly url:    string;
    readonly width:  number;
    readonly height: number;
}

export interface PurplePlaylistPanelVideoWrapperRenderer {
    readonly primaryRenderer: PrimaryRenderer;
    readonly counterpart:     PurpleCounterpart[];
}

export interface PurpleCounterpart {
    readonly counterpartRenderer: PurpleCounterpartRenderer;
    readonly segmentMap:          SegmentMap;
}

export interface PurpleCounterpartRenderer {
    readonly playlistPanelVideoRenderer: PurplePlaylistPanelVideoRenderer;
}

export interface PurplePlaylistPanelVideoRenderer {
    readonly title:                   TitleClass;
    readonly longBylineText:          LongBylineText;
    readonly thumbnail:               ThumbnailDetailsClass;
    readonly lengthText:              LengthText;
    readonly selected:                boolean;
    readonly navigationEndpoint:      CurrentVideoEndpointClass;
    readonly videoId:                 string;
    readonly shortBylineText:         TitleClass;
    readonly trackingParams:          string;
    readonly menu:                    PurpleMenu;
    readonly playlistSetVideoId?:     string;
    readonly canReorder:              boolean;
    readonly playlistEditParams:      PlaylistEditParams;
    readonly queueNavigationEndpoint: FluffyQueueNavigationEndpoint;
}

export interface FluffyQueueNavigationEndpoint {
    readonly clickTrackingParams: string;
    readonly queueAddEndpoint:    FluffyQueueAddEndpoint;
}

export interface FluffyQueueAddEndpoint {
    readonly queueTarget:         Target;
    readonly queueInsertPosition: QueueInsertPosition;
    readonly params:              QueueAddEndpointParams;
}

export interface SegmentMap {
    readonly segment?: Segment[];
}

export interface Segment {
    readonly primaryVideoStartTimeMilliseconds:     string;
    readonly counterpartVideoStartTimeMilliseconds: string;
    readonly durationMilliseconds:                  string;
}

export interface PrimaryRenderer {
    readonly playlistPanelVideoRenderer: ContentPlaylistPanelVideoRenderer;
}

export interface Continuation {
    readonly nextRadioContinuationData: NextRadioContinuationData;
}

export interface NextRadioContinuationData {
    readonly continuation:        string;
    readonly clickTrackingParams: string;
}

export interface PlaylistPanelRendererShuffleToggleButton {
    readonly toggleButtonRenderer: PurpleToggleButtonRenderer;
}

export interface PurpleToggleButtonRenderer {
    readonly defaultIcon:            Icon;
    readonly defaultServiceEndpoint: ToggleButtonRendererDefaultServiceEndpoint;
    readonly toggledIcon:            Icon;
    readonly toggledServiceEndpoint: ToggleButtonRendererDefaultServiceEndpoint;
    readonly trackingParams:         string;
}

export interface ToggleButtonRendererDefaultServiceEndpoint {
    readonly clickTrackingParams:    string;
    readonly watchPlaylistEndpoint?: WatchPlaylistEndpoint;
    readonly watchEndpoint?:         DefaultServiceEndpointWatchEndpoint;
}

export interface DefaultServiceEndpointWatchEndpoint {
    readonly playlistId:     string;
    readonly params:         string;
    readonly playerParams?:  string;
    readonly loggingContext: LoggingContext;
}

export interface Header {
    readonly musicQueueHeaderRenderer: MusicQueueHeaderRenderer;
}

export interface MusicQueueHeaderRenderer {
    readonly title:          TitleClass;
    readonly subtitle:       TitleClass;
    readonly buttons:        Button[];
    readonly trackingParams: string;
}

export interface Button {
    readonly chipCloudChipRenderer: ButtonChipCloudChipRenderer;
}

export interface ButtonChipCloudChipRenderer {
    readonly style:              StyleClass;
    readonly text:               TitleClass;
    readonly navigationEndpoint: PurpleNavigationEndpoint;
    readonly trackingParams:     string;
    readonly icon:               Icon;
    readonly accessibilityData:  Accessibility;
    readonly isSelected:         boolean;
    readonly uniqueId:           string;
}

export interface PurpleNavigationEndpoint {
    readonly clickTrackingParams:        string;
    readonly saveQueueToPlaylistCommand: Command;
}

export interface StyleClass {
    readonly styleType: string;
}

export interface SubHeaderChipCloud {
    readonly chipCloudRenderer: ChipCloudRenderer;
}

export interface ChipCloudRenderer {
    readonly chips:             Chip[];
    readonly trackingParams:    string;
    readonly selectionBehavior: string;
}

export interface Chip {
    readonly chipCloudChipRenderer: ChipChipCloudChipRenderer;
}

export interface ChipChipCloudChipRenderer {
    readonly text:               TitleClass;
    readonly navigationEndpoint: FluffyNavigationEndpoint;
    readonly trackingParams:     string;
    readonly accessibilityData:  Accessibility;
    readonly isSelected:         boolean;
    readonly uniqueId:           string;
}

export interface FluffyNavigationEndpoint {
    readonly clickTrackingParams: string;
    readonly queueUpdateCommand:  QueueUpdateCommand;
}

export interface QueueUpdateCommand {
    readonly queueUpdateSection:      QueueUpdateSection;
    readonly fetchContentsCommand:    FetchContentsCommand;
    readonly dedupeAgainstLocalQueue: boolean;
    readonly syncMode:                SyncMode;
}

export interface FetchContentsCommand {
    readonly clickTrackingParams: string;
    readonly watchEndpoint:       DefaultServiceEndpointWatchEndpoint;
}

export type QueueUpdateSection = "QUEUE_UPDATE_SECTION_QUEUE" | "QUEUE_UPDATE_SECTION_AUTOPLAY";

export type SyncMode = "QUEUE_UPDATE_SYNC_MODE_DEDUPE_AGAINST_LOCAL";

export type TitleEnum = "Up next" | "Lyrics" | "Related";

export interface ContinuationContents {
    readonly playlistPanelContinuation: PlaylistPanelContinuation;
}

export interface PlaylistPanelContinuation {
    readonly contents:            PlaylistPanelContinuationContent[];
    readonly playlistId:          PlaylistID;
    readonly isInfinite:          boolean;
    readonly continuations:       Continuation[];
    readonly trackingParams:      string;
    readonly numItemsToShow:      number;
    readonly shuffleToggleButton: PlaylistPanelContinuationShuffleToggleButton;
}

export interface PlaylistPanelContinuationContent {
    readonly playlistPanelVideoRenderer?:        ContentPlaylistPanelVideoRenderer;
    readonly playlistPanelVideoWrapperRenderer?: FluffyPlaylistPanelVideoWrapperRenderer;
}

export interface FluffyPlaylistPanelVideoWrapperRenderer {
    readonly primaryRenderer: PrimaryRenderer;
    readonly counterpart:     FluffyCounterpart[];
}

export interface FluffyCounterpart {
    readonly counterpartRenderer: FluffyCounterpartRenderer;
    readonly segmentMap:          SegmentMap;
}

export interface FluffyCounterpartRenderer {
    readonly playlistPanelVideoRenderer: FluffyPlaylistPanelVideoRenderer;
}

export interface FluffyPlaylistPanelVideoRenderer {
    readonly title:                   TitleClass;
    readonly longBylineText:          TitleClass;
    readonly thumbnail:               ThumbnailDetailsClass;
    readonly lengthText:              LengthText;
    readonly selected:                boolean;
    readonly navigationEndpoint:      CurrentVideoEndpointClass;
    readonly videoId:                 string;
    readonly shortBylineText:         TitleClass;
    readonly trackingParams:          string;
    readonly menu:                    FluffyMenu;
    readonly playlistSetVideoId:      string;
    readonly canReorder:              boolean;
    readonly playlistEditParams:      PlaylistEditParams;
    readonly queueNavigationEndpoint: FluffyQueueNavigationEndpoint;
}

export interface FluffyMenu {
    readonly menuRenderer: FluffyMenuRenderer;
}

export interface FluffyMenuRenderer {
    readonly items:          FluffyItem[];
    readonly trackingParams: string;
    readonly accessibility:  Accessibility;
}

export interface FluffyItem {
    readonly menuNavigationItemRenderer?:      MenuItemRenderer;
    readonly menuServiceItemRenderer?:         MenuItemRenderer;
    readonly toggleMenuServiceItemRenderer?:   FluffyToggleMenuServiceItemRenderer;
    readonly menuServiceItemDownloadRenderer?: MenuServiceItemDownloadRenderer;
}

export interface FluffyToggleMenuServiceItemRenderer {
    readonly defaultText:            TitleClass;
    readonly defaultIcon:            Icon;
    readonly defaultServiceEndpoint: ServiceEndpoint;
    readonly toggledText:            TitleClass;
    readonly toggledIcon:            Icon;
    readonly toggledServiceEndpoint: ServiceEndpoint;
    readonly trackingParams:         string;
}

export interface ServiceEndpoint {
    readonly clickTrackingParams: string;
    readonly likeEndpoint:        LikeEndpoint;
}

export interface PlaylistPanelContinuationShuffleToggleButton {
    readonly toggleButtonRenderer: FluffyToggleButtonRenderer;
}

export interface FluffyToggleButtonRenderer {
    readonly defaultIcon:            Icon;
    readonly defaultServiceEndpoint: DefaultServiceEndpointClass;
    readonly toggledIcon:            Icon;
    readonly toggledServiceEndpoint: DefaultServiceEndpointClass;
    readonly trackingParams:         string;
}

export interface PlayerOverlays {
    readonly playerOverlayRenderer: PlayerOverlayRenderer;
}

export interface PlayerOverlayRenderer {
    readonly actions:             PlayerOverlayRendererAction[];
    readonly browserMediaSession: BrowserMediaSession;
}

export interface PlayerOverlayRendererAction {
    readonly likeButtonRenderer: LikeButtonRenderer;
}

export interface LikeButtonRenderer {
    readonly target:           Target;
    readonly likeStatus:       Status;
    readonly trackingParams:   string;
    readonly likesAllowed:     boolean;
    readonly serviceEndpoints: ServiceEndpoint[];
}

export interface BrowserMediaSession {
    readonly browserMediaSessionRenderer: BrowserMediaSessionRenderer;
}

export interface BrowserMediaSessionRenderer {
    readonly album?:           TitleClass;
    readonly thumbnailDetails: ThumbnailDetailsClass;
}

export interface ResponseContext {
    readonly serviceTrackingParams: ServiceTrackingParam[];
    readonly innertubeTokenJar?:    InnertubeTokenJar;
}

export interface InnertubeTokenJar {
    readonly appTokens: AppToken[];
}

export interface AppToken {
    readonly type:             number;
    readonly value:            string;
    readonly maxAgeSeconds:    number;
    readonly creationTimeUsec: string;
}

export interface ServiceTrackingParam {
    readonly service: Service;
    readonly params:  Param[];
}

export interface Param {
    readonly key:   Key;
    readonly value: string;
}

export type Key = "c" | "cver" | "yt_li" | "GetWatchNext_rid" | "logged_in" | "client.version" | "client.name";

export type Service = "CSI" | "GFEEDBACK" | "ECATCHER";

export interface VideoReporting {
    readonly reportFormModalRenderer: ReportFormModalRenderer;
}

export interface ReportFormModalRenderer {
    readonly optionsSupportedRenderers: OptionsSupportedRenderers;
    readonly trackingParams:            string;
    readonly title:                     TitleClass;
    readonly submitButton:              CancelButtonClass;
    readonly cancelButton:              CancelButtonClass;
    readonly footer:                    Footer;
}

export interface CancelButtonClass {
    readonly buttonRenderer: ButtonRenderer;
}

export interface ButtonRenderer {
    readonly style:          StyleEnum;
    readonly isDisabled:     boolean;
    readonly text:           TitleClass;
    readonly trackingParams: string;
}

export type StyleEnum = "STYLE_TEXT" | "STYLE_BRAND";

export interface Footer {
    readonly runs: FooterRun[];
}

export interface FooterRun {
    readonly text:                string;
    readonly navigationEndpoint?: RunNavigationEndpoint;
}

export interface RunNavigationEndpoint {
    readonly clickTrackingParams: string;
    readonly urlEndpoint:         URLEndpoint;
}

export interface URLEndpoint {
    readonly url: string;
}

export interface OptionsSupportedRenderers {
    readonly optionsRenderer: OptionsRenderer;
}

export interface OptionsRenderer {
    readonly items:          OptionsRendererItem[];
    readonly trackingParams: string;
}

export interface OptionsRendererItem {
    readonly optionSelectableItemRenderer: OptionSelectableItemRenderer;
}

export interface OptionSelectableItemRenderer {
    readonly text:           TitleClass;
    readonly trackingParams: string;
    readonly submitEndpoint: SubmitEndpoint;
}

export interface SubmitEndpoint {
    readonly clickTrackingParams: string;
    readonly flagEndpoint:        FlagEndpoint;
}

export interface FlagEndpoint {
    readonly flagAction: string;
}
