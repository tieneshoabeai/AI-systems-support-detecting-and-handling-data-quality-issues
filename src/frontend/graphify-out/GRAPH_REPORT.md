# Graph Report - src  (2026-11-26)

## Corpus Check
- 503 files · ~336,103 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 64 file(s) not represented in the graph (top: .css 51, (none) 12, .ttf 1)

## Summary
- 3081 nodes · 8464 edges · 113 communities (109 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 152 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `52e086f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dataset Preview & Session Runtime (ref_node_fs)
- auth.ts
- types/index.ts
- Data Stream & Trajectory Paths (inbound-stream-paths.ts)
- use-management-store.ts
- projects.ts
- ref_vitest
- ref_react
- 3D Visualization & Geometry (generated-core.ts)
- Dataset Preview & Session Runtime (neon-cube.preview.ts)
- app-router.tsx
- workbench-presentation.ts
- 3D Visualization & Geometry (ProceduralModelRuntime)
- isRecord
- PageSkeleton
- 3D Visualization & Geometry (neon-cube.model.ts)
- 3D Visualization & Geometry (holographic-core.model.ts)
- ref_three
- src/graphics/holographic-core/index.ts
- holographic-core.scene.tsx
- 3D Visualization & Geometry (createOctagonalTowerGeometry())
- Dataset Preview & Session Runtime (upload-draft.config.ts)
- src/graphics/auth-glass/index.ts
- 3D Visualization & Geometry (SPOOL_CORE)
- 3D Visualization & Geometry (tower-architecture.ts)
- holographic-core.decor.tsx
- project-info-card.tsx
- core-visual-config.ts
- resource-hardware.tsx
- math/workspace-3d/index.ts
- usePreviewSession
- management.store.ts
- resource-scene.tsx
- workspaces.ts
- workspaces.view.tsx
- session-coordinator.types.ts
- Authentication & Security (app-runtime.ts)
- session-coordinator.test.ts
- types/users/index.ts
- types/dataset-3d/index.ts
- issues.ts
- 3D Visualization & Geometry (holographic-towers.test.ts)
- src/graphics/index.ts
- 3D Visualization & Geometry (tower-gauge-data.ts)
- ApiError
- login/login.view.tsx
- dataset-3d.view.tsx
- workspace-3d.view.tsx
- resource-layout.ts
- presentation.test.tsx
- 3D Visualization & Geometry (graphics_neon_cube_object_sculpt_spec)
- auth-glass.artwork.ts
- feedback.ts
- Icon
- App Shell & Providers (animateExplode())
- holographic-core.environment.tsx
- analysis-feedback-panel.tsx
- Domain Module 57 (frame())
- Domain Module 58 (vite-env.d.ts)
- project-workspace.view.tsx
- resource-avatar.tsx
- auth-flow.test.tsx
- management-mock-store.ts
- legacy-workbench-route.ts
- datasets.ts
- home.view.tsx
- home-universe.tsx
- analysis.ts
- project-data-actions.tsx
- openapi.ts
- dataViewVirtualGrid.ts
- notifications.ts
- assets
- management-fixture-scenarios.ts
- management-fixtures.ts
- dataset-distribution.tsx
- controls.test.tsx
- dataset.service.ts
- workbench-session.tsx
- src/README.md
- hooks
- live-dataset-panel.tsx
- __tests__
- requireDefined
- renderFrame
- workbench-test-kit.tsx
- analysis.service.ts
- views
- project-panel-controls.tsx
- repositories
- sync
- workbench-routes.tsx
- configs
- report.ts
- app
- cube-connection-focus.ts
- analysis-correlation-matrix.tsx
- summary.ts
- users.ts
- notifications.test.tsx
- management-views.test.tsx
- overview.ts
- NotFoundView
- recent-projects.service.ts
- Lib
- management/index.ts
- Services
- ConfirmedProjectResult
- Utils
- UI components
- account.service.ts
- Types

## God Nodes (most connected - your core abstractions)
1. `requireDefined()` - 165 edges
2. `ApiError` - 64 edges
3. `usePreviewSession()` - 58 edges
4. `isRecord()` - 48 edges
5. `Icon()` - 45 edges
6. `useManagementStore()` - 44 edges
7. `createManagementStore()` - 42 edges
8. `Dialog()` - 33 edges
9. `Button()` - 32 edges
10. `HomePreviewView()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `5. Cấu trúc thư mục` --references--> `ProtectedRoute()`  [INFERRED]
  src/app/README.md → src/app/guards/protected-route.tsx
- `2. Vị trí & phụ thuộc` --references--> `WorkbenchRoutes()`  [INFERRED]
  src/views/README.md → src/app/router/workbench-routes.tsx
- `DisplayBase` --references--> `DisplayBase()`  [INFERRED]
  src/graphics/auth-glass/display-base/README.md → src/components/graphics/auth-glass/display-base/display-base.tsx
- `10. Giới hạn & lưu ý` --references--> `getApiConfig()`  [INFERRED]
  src/configs/README.md → src/configs/api.config.ts
- `6. Luồng hoạt động` --references--> `getApiConfig()`  [INFERRED]
  src/configs/README.md → src/configs/api.config.ts

## Import Cycles
- None detected.

## Communities (113 total, 4 thin omitted)

### Community 0 - "Dataset Preview & Session Runtime (ref_node_fs)"
Cohesion: 0.05
Nodes (54): bodyPairs, code, contrast(), css, definitions, fillPairs, luminance(), rgb() (+46 more)

### Community 1 - "auth.ts"
Cohesion: 0.01
Nodes (135): deleteAuthByIdRevokeSessionParams, deleteAuthByIdRevokeSessionParamsPath, deleteAuthByIdRevokeSessionRequest, deleteAuthByIdRevokeSessionResponse200, deleteAuthByIdRevokeSessionResponse200Content, deleteAuthByIdRevokeSessionResponse400, deleteAuthByIdRevokeSessionResponse400Content, deleteAuthByIdRevokeSessionResponse401 (+127 more)

### Community 2 - "types/index.ts"
Cohesion: 0.07
Nodes (51): statusLabels, ProjectMembersData, SessionDetail, WorkspaceDetailOverview, WorkspaceOverview, ActivityEntry, DatasetStatus, NewProjectDatasetInput (+43 more)

### Community 3 - "Data Stream & Trajectory Paths (inbound-stream-paths.ts)"
Cohesion: 0.05
Nodes (51): bezierPoint, buildPath(), createInboundGuidePaths(), createInboundPaths(), definePath(), evaluateBezier(), InboundPath, InboundPathDefinition (+43 more)

### Community 4 - "use-management-store.ts"
Cohesion: 0.08
Nodes (40): ProjectSteps(), delimiterLabel(), MemberPick, memberStepNotes, PickedCsv, ProjectWizard(), steps, LiveProjectMembersDialog() (+32 more)

### Community 5 - "projects.ts"
Cohesion: 0.03
Nodes (62): deleteProjectsByIdAndUserIdMemberParams, deleteProjectsByIdAndUserIdMemberParamsPath, deleteProjectsByIdAndUserIdMemberRequest, deleteProjectsByIdAndUserIdMemberResponse200, deleteProjectsByIdAndUserIdMemberResponses, deleteProjectsByIdProjectParams, deleteProjectsByIdProjectParamsPath, deleteProjectsByIdProjectRequest (+54 more)

### Community 6 - "ref_vitest"
Cohesion: 0.16
Nodes (6): ManagementStoreContext, previewColorKey, appearance, AuthenticatedWorkbenchEntry(), routingSession, previewMockStore

### Community 7 - "ref_react"
Cohesion: 0.09
Nodes (36): DataRegionStatus(), RecentProjects(), Tải dữ liệu theo vùng, PreviewPopover(), AuthContext, ManagementLoading, ManagementLoadingContext, ManagementOverviewLoaderContext (+28 more)

### Community 8 - "3D Visualization & Geometry (generated-core.ts)"
Cohesion: 0.08
Nodes (39): AttachmentEndpoint, buildExtrudeGeometry(), buildExtrudeShape(), buildLatheGeometry(), clamp01(), clampAlbedoChannel(), clampedAlbedoColor(), clampPbrF0() (+31 more)

### Community 9 - "Dataset Preview & Session Runtime (neon-cube.preview.ts)"
Cohesion: 0.04
Nodes (39): ambientLight, azimuth, bloom, camera, CameraFrame, clayAmbient, clayBackground, clayFill (+31 more)

### Community 10 - "app-router.tsx"
Cohesion: 0.20
Nodes (12): App(), LOGIN_PATH, ProtectedRoute(), SessionStatus(), PublicOnlyRoute(), AppRouter(), Entry(), WorkbenchRoutes (+4 more)

### Community 11 - "workbench-presentation.ts"
Cohesion: 0.08
Nodes (46): InboxRow(), NotificationCenter(), QuickRow(), CenterView, formatSize(), ReportCenter(), ReportRow(), ReportStatusChip() (+38 more)

### Community 12 - "3D Visualization & Geometry (ProceduralModelRuntime)"
Cohesion: 0.10
Nodes (32): ProceduralModelRuntime, createTowerCrowns(), buildHeroColumn(), cellColors(), CAP_REFERENCE, CELL_GAIN, CONTEXT_GAUGES, DIMENSION_LABELS (+24 more)

### Community 13 - "isRecord"
Cohesion: 0.16
Nodes (21): queryClient, composeApiConfig(), DEFAULT_API_TIMEOUT_MS, getApiConfig(), parseApiConfig(), Từ cấu hình đến caller, isRecord(), normalizeApiError() (+13 more)

### Community 14 - "PageSkeleton"
Cohesion: 0.22
Nodes (11): root, rootElement, LoginSceneSkeleton(), PageSkeleton(), ProjectHeaderSkeleton(), ProjectSceneSkeleton(), RecentProjectSkeletonRows(), WorkspaceCardsSkeleton() (+3 more)

### Community 15 - "3D Visualization & Geometry (neon-cube.model.ts)"
Cohesion: 0.09
Nodes (39): NeonCubeNodes(), isMesh(), createNeonCubeCluster(), NeonCubeCluster, NEON_CUBE_LABELS, buildCornerMarkers(), buildEdgeFrame(), buildLightSheets() (+31 more)

### Community 16 - "3D Visualization & Geometry (holographic-core.model.ts)"
Cohesion: 0.09
Nodes (37): resolveCoreGlow(), addBaseWallGrid(), addCapSolarRays(), addCylinderGrid(), addDeckRecess(), addEdgeRods(), addHotspot(), addPlanarGrid() (+29 more)

### Community 17 - "ref_three"
Cohesion: 0.13
Nodes (20): AuthGlassBackdrop(), showBackdrop(), updateCrop(), createRenderResources(), authGlassConfig, authGlassDebugModes, parseAuthGlassView(), alignPanelAtSeam() (+12 more)

### Community 18 - "src/graphics/holographic-core/index.ts"
Cohesion: 0.12
Nodes (25): CubeLabel(), CubeLabels(), isInsideGlass(), isVisible(), writesDepth(), HOLOGRAPHIC_CAMERA, CUBE_LABEL_ASPECT, CUBE_LABEL_LAYOUT (+17 more)

### Community 19 - "holographic-core.scene.tsx"
Cohesion: 0.09
Nodes (25): CameraControls(), CoreStructure(), CoreStructureProps, CubeFocusProps, HolographicBloom(), HolographicCoreCanvas(), HolographicCoreCanvasProps, HolographicScene() (+17 more)

### Community 20 - "3D Visualization & Geometry (createOctagonalTowerGeometry())"
Cohesion: 0.11
Nodes (24): createOctagonalTowerGeometry(), createTowerMaterials(), DETACH_DISTANCE, ORIGINAL_TOWERS, OriginalTower, OUTER_TOWER_IDS, OUTER_TOWERS, OuterTower (+16 more)

### Community 21 - "Dataset Preview & Session Runtime (upload-draft.config.ts)"
Cohesion: 0.13
Nodes (13): ClientOptions, RuntimeOptions, UPLOAD_DRAFT_LIMITS, UploadDraftDatabase, createUploadDraftRepository(), Options, sessionError(), storageError() (+5 more)

### Community 22 - "src/graphics/auth-glass/index.ts"
Cohesion: 0.12
Nodes (28): DisplayBase(), pearlTierColors, useBaseEnvironment(), faceHeight, faceWidth, faceZ, formToPanel, projectAuthForm() (+20 more)

### Community 23 - "3D Visualization & Geometry (SPOOL_CORE)"
Cohesion: 0.16
Nodes (17): createSpoolCore(), applyExplode(), applyNucleus(), applyParticles(), reset(), glowTexture(), IDENTITY, latheBand() (+9 more)

### Community 24 - "3D Visualization & Geometry (tower-architecture.ts)"
Cohesion: 0.11
Nodes (21): addTowerCornerPosts(), buildCompositeHero(), buildTowerArchitecture(), createBeveledTowerGeometry(), MARK_SEQUENCE, octagonalFootprint(), octagonalRingsGeometry(), SHORT_BAR (+13 more)

### Community 25 - "holographic-core.decor.tsx"
Cohesion: 0.06
Nodes (49): CONSTELLATIONS, createAsteroidBelt(), createCelestialGrid(), createConstellations(), createDust(), createOrbitDial(), update(), createPlanet() (+41 more)

### Community 26 - "project-info-card.tsx"
Cohesion: 0.08
Nodes (30): InfoSurface(), ProjectInfoCard(), PreviewToaster(), ContextMenu(), DialogSurface(), Props, Popover(), PopoverSurface() (+22 more)

### Community 27 - "core-visual-config.ts"
Cohesion: 0.06
Nodes (48): CLEAN_LOOP_POINTS, CORE_GLOW_V2, CORE_GLOW_V3, CORE_NUCLEUS_V3, CORE_NUCLEUS_V4, CORE_VISUAL_REVISION, CoreGlowEntry, CoreVisualRevision (+40 more)

### Community 28 - "resource-hardware.tsx"
Cohesion: 0.23
Nodes (16): AnnularPart(), DatasetCartridge(), FinishMaterial(), noPorts, PartProps, ProjectModule(), ResourceHardware(), RoundedPart() (+8 more)

### Community 29 - "math/workspace-3d/index.ts"
Cohesion: 0.25
Nodes (16): Props, Transition, clampTarget(), fitPose(), nodeCorners(), overviewDirection(), overviewPose(), panPose() (+8 more)

### Community 30 - "usePreviewSession"
Cohesion: 0.10
Nodes (42): ActionNote(), Panel(), useManagementStore(), readSidebarCollapsed(), sidebarPreferenceKey, notificationPrefRows, settingsModuleOfSection(), settingsModules (+34 more)

### Community 31 - "management.store.ts"
Cohesion: 0.07
Nodes (41): AdminIssue, AdminService, AdminUser, createAdminService(), cursorPage(), isRecord(), mapAdminIssue(), mapAdminUser() (+33 more)

### Community 32 - "resource-scene.tsx"
Cohesion: 0.19
Nodes (12): attachEnvironment(), HardwareLighting(), ResourceCameraController(), DataPipe(), Props, ResourceScene(), SceneBoundary, SceneController() (+4 more)

### Community 33 - "workspaces.ts"
Cohesion: 0.04
Nodes (49): deleteWorkspacesByIdAndUserIdMemberParams, deleteWorkspacesByIdAndUserIdMemberParamsPath, deleteWorkspacesByIdAndUserIdMemberRequest, deleteWorkspacesByIdAndUserIdMemberResponse200, deleteWorkspacesByIdAndUserIdMemberResponses, deleteWorkspacesByIdWorkspaceParams, deleteWorkspacesByIdWorkspaceParamsPath, deleteWorkspacesByIdWorkspaceRequest (+41 more)

### Community 34 - "workspaces.view.tsx"
Cohesion: 0.09
Nodes (40): ChartRow, datasetLabels, DetailTabs(), EmptyHint(), FilterTabs(), Pagination(), PaginationProps, ProgressBar() (+32 more)

### Community 35 - "session-coordinator.types.ts"
Cohesion: 0.12
Nodes (27): isLoginResponse(), isNonemptyString(), mapLoginResponse(), anonymous, authenticated, base, calls, Location() (+19 more)

### Community 36 - "Authentication & Security (app-runtime.ts)"
Cohesion: 0.18
Nodes (12): createAuthService(), createHealthService(), Chọn đúng chỗ khi sửa, createUsersService(), accessToken(), fixture(), setup(), health() (+4 more)

### Community 37 - "session-coordinator.test.ts"
Cohesion: 0.13
Nodes (21): createSessionStorage(), SESSION_STORAGE_KEY, SessionStorageOptions, validateSession(), createSessionCoordinator(), safeError(), sessionError(), failure() (+13 more)

### Community 39 - "types/dataset-3d/index.ts"
Cohesion: 0.39
Nodes (5): CubeFocus, HolographicPartComponent, HolographicPartDimensions, HolographicPartInfo, NON_SELECTABLE_PART_IDS

### Community 40 - "issues.ts"
Cohesion: 0.04
Nodes (46): getAdminByIdForParams, getAdminByIdForParamsPath, getAdminByIdForRequest, getAdminByIdForResponse200, getAdminByIdForResponses, getAdminForParams, getAdminForParamsQuery, getAdminForRequest (+38 more)

### Community 41 - "3D Visualization & Geometry (holographic-towers.test.ts)"
Cohesion: 0.11
Nodes (22): createHolographicCoreProductModel(), TOWER_IDS, ALL_IDS, BASE_Y, boundingSize(), clearance(), createRuntime(), footprintHalf() (+14 more)

### Community 42 - "src/graphics/index.ts"
Cohesion: 0.07
Nodes (19): useAuthGlassRender(), AssemblyDrag, AuthGlassReview(), AuthGlassStage(), endDrag(), openPanel(), focusPanelField(), FormRef (+11 more)

### Community 43 - "3D Visualization & Geometry (tower-gauge-data.ts)"
Cohesion: 0.15
Nodes (19): bucketBottoms(), bucketTops(), CellKind, createMockQualityScoreSource(), deriveCells(), litCount(), mismatchIndices(), MOCK_SCOPES (+11 more)

### Community 44 - "ApiError"
Cohesion: 0.12
Nodes (34): ApiError, resolveApiPath(), createManagementStore(), cursorPages(), load(), loadCardData(), loadDataset(), loadMembers() (+26 more)

### Community 45 - "login/login.view.tsx"
Cohesion: 0.13
Nodes (11): DataVerseMark(), createAccountService(), startGoogleSignIn(), mount(), AuthGlassReview, AuthGlassStage, LoginView(), AuthProviderButtons() (+3 more)

### Community 46 - "dataset-3d.view.tsx"
Cohesion: 0.17
Nodes (8): canvasProbe, CanvasProps, FIXTURE, Dataset3DView(), Dataset3DViewProps, formatDimensions(), MODULE_THEMES, useReducedMotion()

### Community 47 - "workspace-3d.view.tsx"
Cohesion: 0.17
Nodes (14): hidden(), reduced(), serverReduced(), subscribeMotion(), subscribeVisibility(), useSceneMotion(), resourceTrail(), validateResources() (+6 more)

### Community 48 - "resource-layout.ts"
Cohesion: 0.13
Nodes (23): Bản đồ file, Cấu trúc thư mục hiện tại, Kiểm thử, Math, Từ dữ liệu tài nguyên đến scene, Điểm nối giữa math, view và scene, connectionRadius(), layoutResources() (+15 more)

### Community 49 - "presentation.test.tsx"
Cohesion: 0.09
Nodes (10): BrandLockup(), Pagination(), PaginationProps, TabItem, Alert(), EmptyState(), Panel(), Badge() (+2 more)

### Community 50 - "3D Visualization & Geometry (graphics_neon_cube_object_sculpt_spec)"
Cohesion: 0.22
Nodes (7): components, materials, repetitions, spec, SpecComponent, SpecMaterial, SpecRepetition

### Community 51 - "auth-glass.artwork.ts"
Cohesion: 0.26
Nodes (12): darkPalette, drawLogin(), drawProviders(), drawRegister(), field(), lightPalette, Palette, roundedRect() (+4 more)

### Community 52 - "feedback.ts"
Cohesion: 0.05
Nodes (36): deleteFeedbackByIdParams, deleteFeedbackByIdParamsPath, deleteFeedbackByIdRequest, deleteFeedbackByIdResponse200, deleteFeedbackByIdResponses, getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParams, getAnalysesByAnalysisIdAndFindingIdFindingFeedbackParamsPath, getAnalysesByAnalysisIdAndFindingIdFindingFeedbackRequest (+28 more)

### Community 53 - "Icon"
Cohesion: 0.11
Nodes (20): ColorModeSelect(), modes, ProjectWorkspacePicker(), Button(), ButtonProps, CompletionButton(), CompletionButtonProps, Icon() (+12 more)

### Community 54 - "App Shell & Providers (animateExplode())"
Cohesion: 0.40
Nodes (6): animateExplode(), step(), applyExplode(), measureExplodedFrame(), resetView(), updateViewLabel()

### Community 55 - "holographic-core.environment.tsx"
Cohesion: 0.07
Nodes (43): AuroraCurtain(), AuroraCurtainField, Backdrop(), createAuroraCurtain(), createCrystalField(), createGroundTexture(), createLightDust(), createMeteorTrail() (+35 more)

### Community 56 - "analysis-feedback-panel.tsx"
Cohesion: 0.11
Nodes (26): Textarea(), AnalysisService, AnalysisFeedbackPanel(), date, Draft, FeedbackItem, labels, message() (+18 more)

### Community 57 - "Domain Module 57 (frame())"
Cohesion: 0.83
Nodes (4): frame(), renderStatus(), setClay(), setExploded()

### Community 59 - "project-workspace.view.tsx"
Cohesion: 0.13
Nodes (26): PreviewMenuDescriptor, projectDatasetMenu(), projectMenu(), formatCount(), formatDataSize(), formatRows(), projectStatsFor(), projectTabsFor() (+18 more)

### Community 60 - "resource-avatar.tsx"
Cohesion: 0.16
Nodes (27): AdaptiveArt(), ArtMotionControl(), read(), subscribe(), useMotion(), AvatarArtwork(), ResourceAvatar(), ResourceAvatarPicker() (+19 more)

### Community 61 - "auth-flow.test.tsx"
Cohesion: 0.11
Nodes (21): AppRuntime, createAppRuntime(), AuthProvider(), getUnavailable(), Props, unavailable, AppProviders(), Props (+13 more)

### Community 62 - "management-mock-store.ts"
Cohesion: 0.10
Nodes (28): isFixtureSetId(), clone(), commit(), coverBySeed, createProject(), createReport(), createWorkspace(), delay() (+20 more)

### Community 63 - "legacy-workbench-route.ts"
Cohesion: 0.15
Nodes (27): LegacyRedirect(), ProjectStepRedirect(), defaultAuthenticatedPath, isProcessingPath(), isWorkbenchPath(), managementHref(), parseManagementRoute(), parseProjectRoute() (+19 more)

### Community 64 - "datasets.ts"
Cohesion: 0.06
Nodes (31): deleteDatasetsByIdDatasetParams, deleteDatasetsByIdDatasetParamsPath, deleteDatasetsByIdDatasetRequest, deleteDatasetsByIdDatasetResponse204, deleteDatasetsByIdDatasetResponses, getDatasetsByIdDownloadDatasetFileParams, getDatasetsByIdDownloadDatasetFileParamsPath, getDatasetsByIdDownloadDatasetFileRequest (+23 more)

### Community 65 - "home.view.tsx"
Cohesion: 0.15
Nodes (25): heroValues, HomeUniverse, UniverseHero(), UniverseHeroProps, originFromEvent(), PreviewCardProps, previewCardProps(), stopCardBubble() (+17 more)

### Community 66 - "home-universe.tsx"
Cohesion: 0.13
Nodes (23): HeroSpaceHole(), DataGlobe(), drifters, FloatingPlanet(), HaloPlanet(), HomeUniverse(), Mix, Nebula() (+15 more)

### Community 67 - "analysis.ts"
Cohesion: 0.08
Nodes (25): getAnalysisByJobIdAiJobParams, getAnalysisByJobIdAiJobParamsPath, getAnalysisByJobIdAiJobRequest, getAnalysisByJobIdAiJobResponse200, getAnalysisByJobIdAiJobResponses, getProjectsByProjectIdAnalysisResultParams, getProjectsByProjectIdAnalysisResultParamsPath, getProjectsByProjectIdAnalysisResultRequest (+17 more)

### Community 68 - "project-data-actions.tsx"
Cohesion: 0.13
Nodes (12): ResultReviewDialog(), Gia hạn phiên, Project gần đây, Đánh giá kết quả và scene 3D, Đọc luồng từ code, useResultReview(), validateCsvFile(), validateResultReview() (+4 more)

### Community 69 - "openapi.ts"
Cohesion: 0.10
Nodes (19): $defs, operations, paths, webhooks, getAdminByIdDetailParams, getAdminByIdDetailParamsPath, getAdminByIdDetailRequest, getAdminByIdDetailResponse200 (+11 more)

### Community 70 - "dataViewVirtualGrid.ts"
Cohesion: 0.09
Nodes (22): getDatasetsByDatasetIdAndColumnColumnStatsParams, getDatasetsByDatasetIdAndColumnColumnStatsParamsPath, getDatasetsByDatasetIdAndColumnColumnStatsRequest, getDatasetsByDatasetIdAndColumnColumnStatsResponse200, getDatasetsByDatasetIdAndColumnColumnStatsResponses, getDatasetsByDatasetIdChartDataParams, getDatasetsByDatasetIdChartDataParamsPath, getDatasetsByDatasetIdChartDataParamsQuery (+14 more)

### Community 71 - "notifications.ts"
Cohesion: 0.09
Nodes (22): getNotificationsByIdDetailParams, getNotificationsByIdDetailParamsPath, getNotificationsByIdDetailRequest, getNotificationsByIdDetailResponse200, getNotificationsByIdDetailResponses, getNotificationsEndpointParams, getNotificationsEndpointParamsQuery, getNotificationsEndpointRequest (+14 more)

### Community 72 - "assets"
Cohesion: 0.09
Nodes (20): Mixed illustration variants, Preview 2D illustrations, project-branches-v1.png, project-data-flow-v1.png, project-scan-v1.png, workspace-data-network-v1.png, workspace-lattice-v1.png, workspace-orbits-v1.png (+12 more)

### Community 73 - "management-fixture-scenarios.ts"
Cohesion: 0.10
Nodes (16): fixtureSets, manyNotifications(), manyProjects(), manyWorkspaces(), oneProject, oneWorkspace, PreviewFixtureSet, PreviewFixtureSetId (+8 more)

### Community 74 - "management-fixtures.ts"
Cohesion: 0.10
Nodes (19): currentUser, olderAges, olderCovers, olderStatuses, olderWorkspaces(), olderWorkspaceSeeds, seedNotificationPrefs, seedNotifications (+11 more)

### Community 75 - "dataset-distribution.tsx"
Cohesion: 0.14
Nodes (15): DatasetBoxPlot(), DatasetTopCategories(), integer, number, percent, countFormat, DatasetDistribution(), number (+7 more)

### Community 76 - "controls.test.tsx"
Cohesion: 0.17
Nodes (6): FormField(), ControlProps, PasswordInput(), Checkbox(), Input(), InputProps

### Community 77 - "dataset.service.ts"
Cohesion: 0.19
Nodes (17): count(), DatasetService, finite(), frequency(), parseBoxPlot(), parseCategory(), DatasetDetail, CategoryFrequency (+9 more)

### Community 78 - "workbench-session.tsx"
Cohesion: 0.20
Nodes (13): normalize(), readPreference(), readSystemDark(), subscribeSystem(), usePreviewColorScheme(), usePreviewSessionModel(), PreviewSessionContext, previewNavigateEvent (+5 more)

### Community 79 - "src/README.md"
Cohesion: 0.23
Nodes (3): DisplayBase, Bản đồ luồng chức năng, Mã nguồn frontend

### Community 80 - "hooks"
Cohesion: 0.11
Nodes (18): Bản đồ thư mục, Chọn nơi đặt component, Components, Kiểm thử, Từ sự kiện đến kết quả theo nhóm, 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích (+10 more)

### Community 81 - "live-dataset-panel.tsx"
Cohesion: 0.19
Nodes (12): Select(), firstRecordQuery, postDatasetsByDatasetIdQueryRecordsRequestBody, cell(), count, FilterOperator, labelForType(), LiveDatasetPanel() (+4 more)

### Community 82 - "__tests__"
Cohesion: 0.12
Nodes (16): 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 3. Public API, 5. Cấu trúc thư mục, 6. Luồng hoạt động, 7. Cấu hình (+8 more)

### Community 83 - "requireDefined"
Cohesion: 0.22
Nodes (10): Boundary, Cube(), Scene(), WorkspaceUniverse(), triangle(), person, project(), workspace() (+2 more)

### Community 84 - "renderFrame"
Cohesion: 0.18
Nodes (8): previewNoteIds, start(), workspace(), originalMatchMedia, shell(), openCreate(), openList(), renderFrame()

### Community 85 - "workbench-test-kit.tsx"
Cohesion: 0.27
Nodes (10): settingsSections, menuButtonOf(), open(), byCardHeading(), cardByTitle(), disabledButtons(), everyDisabledButtonHasVisibleReason(), menuFor() (+2 more)

### Community 86 - "analysis.service.ts"
Cohesion: 0.14
Nodes (13): SavedAnalysisResult, CreateFeedbackInput, FeedbackQuery, ReportDownload, RunAnalysisInput, UpdateFeedbackInput, ApiResponseWithStatus, postProjectsByProjectIdRunAnalysisRequestBody (+5 more)

### Community 87 - "views"
Cohesion: 0.14
Nodes (14): 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 5. Cấu trúc thư mục, 6. Luồng hoạt động, 7. Cấu hình, 8. Quy ước & bất biến (+6 more)

### Community 88 - "project-panel-controls.tsx"
Cohesion: 0.22
Nodes (10): queueProjectGlassGeometry(), clamp(), Drag, Geometry, measure(), ResizeGrip(), usePanelGrip(), Grip (+2 more)

### Community 89 - "repositories"
Cohesion: 0.15
Nodes (13): 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 3. Public API, 4. Cách dùng (ví dụ), 5. Cấu trúc thư mục, 6. Luồng hoạt động (+5 more)

### Community 90 - "sync"
Cohesion: 0.15
Nodes (13): 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 3. Public API, 4. Cách dùng (ví dụ), 5. Cấu trúc thư mục, 6. Luồng hoạt động (+5 more)

### Community 91 - "workbench-routes.tsx"
Cohesion: 0.32
Nodes (8): 3. Public API, ApplicationFrame, ManagementPage, ProcessingPage, ProcessingProject(), ProjectWorkspacePage, WorkbenchEntry(), WorkbenchRoutes()

### Community 92 - "configs"
Cohesion: 0.17
Nodes (12): 10. Giới hạn & lưu ý, 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 3. Public API, 4. Cách dùng (ví dụ), 5. Cấu trúc thư mục, 6. Luồng hoạt động (+4 more)

### Community 93 - "report.ts"
Cohesion: 0.17
Nodes (11): getProjectsByProjectIdAndReportIdDownloadReportParams, getProjectsByProjectIdAndReportIdDownloadReportParamsPath, getProjectsByProjectIdAndReportIdDownloadReportRequest, getProjectsByProjectIdAndReportIdDownloadReportResponse200, getProjectsByProjectIdAndReportIdDownloadReportResponse202, getProjectsByProjectIdAndReportIdDownloadReportResponses, postProjectsByProjectIdRequestReportParams, postProjectsByProjectIdRequestReportParamsPath (+3 more)

### Community 94 - "app"
Cohesion: 0.18
Nodes (11): Application(), 11. Hướng cải tiến, 1. Mục đích, 2. Vị trí & phụ thuộc, 5. Cấu trúc thư mục, 6. Luồng hoạt động, 7. Cấu hình, 8. Quy ước & bất biến (+3 more)

### Community 95 - "cube-connection-focus.ts"
Cohesion: 0.31
Nodes (9): CONNECTION_REVEAL_SECONDS, createCubeConnectionFocus(), allowPose(), select(), snap(), Pose, cubeConnectionOverview(), Stage (+1 more)

### Community 96 - "analysis-correlation-matrix.tsx"
Cohesion: 0.24
Nodes (8): AnalysisCorrelationMatrix(), arrowOffsets, Cell, coefficient, methods, parseCell(), readMatrix(), reasonLabels

### Community 97 - "summary.ts"
Cohesion: 0.18
Nodes (10): getProjectsByProjectIdSummaryParams, getProjectsByProjectIdSummaryParamsPath, getProjectsByProjectIdSummaryRequest, getProjectsByProjectIdSummaryResponse200, getProjectsByProjectIdSummaryResponses, postProjectsByProjectIdSummaryParams, postProjectsByProjectIdSummaryParamsPath, postProjectsByProjectIdSummaryRequest (+2 more)

### Community 98 - "users.ts"
Cohesion: 0.18
Nodes (10): deleteUsersAccountRequest, deleteUsersAccountResponse200, deleteUsersAccountResponses, getUsersProfileRequest, getUsersProfileResponse200, getUsersProfileResponses, patchUsersProfileRequest, patchUsersProfileRequestBody (+2 more)

### Community 99 - "notifications.test.tsx"
Cohesion: 0.20
Nodes (3): notificationKindLabels, detailScreen(), listScreen()

### Community 100 - "management-views.test.tsx"
Cohesion: 0.24
Nodes (5): attachCsv(), csvFile(), openWorkspacePanel(), menuItem(), rowByTitle()

### Community 101 - "overview.ts"
Cohesion: 0.20
Nodes (9): getOverviewUserWorkspacesRequest, getOverviewUserWorkspacesResponse200, getOverviewUserWorkspacesResponses, getWorkspacesByIdOverviewParams, getWorkspacesByIdOverviewParamsPath, getWorkspacesByIdOverviewRequest, getWorkspacesByIdOverviewResponse200, getWorkspacesByIdOverviewResponse404 (+1 more)

### Community 103 - "recent-projects.service.ts"
Cohesion: 0.31
Nodes (8): listRecentProjects(), nestedText(), RecentProject, RecentProjectsPage, recentProjectsPageSize, text(), ProjectStatus, getProjectsAllParamsQuery

### Community 104 - "Lib"
Cohesion: 0.25
Nodes (8): Bản đồ file, Cấu trúc thư mục hiện tại, Kiểm thử, Lib, Phiên và query cache, Request chạy như thế nào, Đầu vào và đầu ra của từng chức năng, invalid()

### Community 105 - "management/index.ts"
Cohesion: 0.29
Nodes (5): parseLocalCsv(), csv_preview, management_store, management_types, upload_validation

### Community 106 - "Services"
Cohesion: 0.25
Nodes (8): Cấu trúc thư mục hiện tại, Danh mục luồng theo nhóm service, Kiểm thử, Lần theo hai luồng thực tế, Quy ước khi sửa service, Services, Đăng nhập và vòng đời phiên, Đọc schema dataset

### Community 107 - "ConfirmedProjectResult"
Cohesion: 0.36
Nodes (5): CurrentUser, ProcessingStep, ConfirmedProjectResult, ResultReviewInput, Tìm kiểu theo trách nhiệm

### Community 108 - "Utils"
Cohesion: 0.29
Nodes (6): Caller → kiểm tra → kết quả, Cấu trúc thư mục hiện tại, Kiểm thử, Utils, Đọc giá trị bắt buộc, Đọc và kiểm tra hạn token

### Community 109 - "UI components"
Cohesion: 0.33
Nodes (5): Compatibility and visual scope, Components, Luồng theo nhóm component, UI components, Verification

### Community 110 - "account.service.ts"
Cohesion: 0.50
Nodes (3): postAuthForgotPasswordRequestBody, postAuthRegisterRequestBody, postAuthResetPasswordRequestBody

### Community 111 - "Types"
Cohesion: 0.50
Nodes (4): Cấu trúc thư mục hiện tại, Khi backend đổi hợp đồng, Types, Từ OpenAPI đến dữ liệu hiển thị

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireDefined()` connect `requireDefined` to `Dataset Preview & Session Runtime (ref_node_fs)`, `Data Stream & Trajectory Paths (inbound-stream-paths.ts)`, `use-management-store.ts`, `ref_vitest`, `3D Visualization & Geometry (generated-core.ts)`, `Dataset Preview & Session Runtime (neon-cube.preview.ts)`, `app-router.tsx`, `workbench-presentation.ts`, `3D Visualization & Geometry (ProceduralModelRuntime)`, `3D Visualization & Geometry (neon-cube.model.ts)`, `3D Visualization & Geometry (holographic-core.model.ts)`, `ref_three`, `holographic-core.scene.tsx`, `3D Visualization & Geometry (createOctagonalTowerGeometry())`, `Dataset Preview & Session Runtime (upload-draft.config.ts)`, `src/graphics/auth-glass/index.ts`, `3D Visualization & Geometry (SPOOL_CORE)`, `3D Visualization & Geometry (tower-architecture.ts)`, `project-info-card.tsx`, `core-visual-config.ts`, `resource-hardware.tsx`, `math/workspace-3d/index.ts`, `resource-scene.tsx`, `workspaces.view.tsx`, `Authentication & Security (app-runtime.ts)`, `session-coordinator.test.ts`, `3D Visualization & Geometry (holographic-towers.test.ts)`, `src/graphics/index.ts`, `workspace-3d.view.tsx`, `resource-layout.ts`, `3D Visualization & Geometry (graphics_neon_cube_object_sculpt_spec)`, `holographic-core.environment.tsx`, `resource-avatar.tsx`, `auth-flow.test.tsx`, `management-mock-store.ts`, `legacy-workbench-route.ts`, `home.view.tsx`, `home-universe.tsx`, `management-fixture-scenarios.ts`, `management-fixtures.ts`, `renderFrame`, `workbench-test-kit.tsx`, `cube-connection-focus.ts`, `management-views.test.tsx`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ApiError` (e.g. with `3. Public API` and `2. Vị trí & phụ thuộc`) actually correct?**
  _`ApiError` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `Dataset Preview & Session Runtime (ref_node_fs)` be split into smaller, more focused modules?**
  _Cohesion score 0.051923076923076926 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `ApiError` to `session-coordinator.types.ts`, `Authentication & Security (app-runtime.ts)`, `session-coordinator.test.ts`, `use-management-store.ts`, `project-data-actions.tsx`, `Lib`, `Services`, `isRecord`, `dataset.service.ts`, `Dataset Preview & Session Runtime (upload-draft.config.ts)`, `analysis.service.ts`, `analysis-feedback-panel.tsx`, `repositories`, `workbench-routes.tsx`, `configs`, `auth-flow.test.tsx`, `management.store.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.014705882352941176 - nodes in this community are weakly interconnected._
- **Why does `sync` connect `sync` to `src/README.md`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07451923076923077 - nodes in this community are weakly interconnected._