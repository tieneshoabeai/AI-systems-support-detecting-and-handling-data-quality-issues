# Graph Report - src  (2026-11-09)

## Corpus Check
- 196 files · ~218,770 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: (none) 14, .css 7, .ttf 1)

## Summary
- 1499 nodes · 3974 edges · 59 communities (58 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dataset Preview & Session Runtime (ref_node_fs)
- 3D Visualization & Geometry (holographic-core.decor.tsx)
- Dataset Preview & Session Runtime (PreviewSessionModel)
- Data Stream & Trajectory Paths (inbound-stream-paths.ts)
- Reporting & Quality Assessment (PreviewReport)
- Reporting & Quality Assessment (isSettingsNavGroup())
- Reporting & Quality Assessment (PreviewUniverseNavigator)
- Dataset Preview & Session Runtime (CoverHue)
- 3D Visualization & Geometry (generated-core.ts)
- Dataset Preview & Session Runtime (neon-cube.preview.ts)
- Authentication & Security (App.tsx)
- Reporting & Quality Assessment (use-preview-session.ts)
- 3D Visualization & Geometry (ProceduralModelRuntime)
- Authentication & Security (auth-provider.tsx)
- Dataset Preview & Session Runtime (app_design_tokens)
- 3D Visualization & Geometry (neon-cube.model.ts)
- 3D Visualization & Geometry (holographic-core.model.ts)
- Authentication & Security (graphics_auth_glass_auth_glass)
- 3D Visualization & Geometry (HOLOGRAPHIC_CAMERA)
- 3D Visualization & Geometry (cubeLabelFocusPose())
- 3D Visualization & Geometry (createOctagonalTowerGeometry())
- Dataset Preview & Session Runtime (upload-draft.config.ts)
- 3D Visualization & Geometry (display-base.tsx)
- 3D Visualization & Geometry (SPOOL_CORE)
- 3D Visualization & Geometry (tower-architecture.ts)
- Reporting & Quality Assessment (preview-mock.service.ts)
- Authentication & Security (preview-fixtures.ts)
- Reporting & Quality Assessment (core-visual-config.ts)
- 3D Visualization & Geometry (connection-geometry.ts)
- Dataset Preview & Session Runtime (resource-camera-controller.tsx)
- Dataset Preview & Session Runtime (people)
- Authentication & Security (previewNavigateEvent)
- 3D Visualization & Geometry (assets_8da_ai_network_logo)
- Reporting & Quality Assessment (resolveCoreNucleus())
- Test Suite & Mocks (hardware-lighting.tsx)
- Authentication & Security (auth-context.ts)
- Authentication & Security (app-runtime.ts)
- Dataset Preview & Session Runtime (session-storage.ts)
- Authentication & Security (session-coordinator.ts)
- 3D Visualization & Geometry (TOWER_IDS)
- Dataset Preview & Session Runtime (preview-worst-case.test.tsx)
- 3D Visualization & Geometry (holographic-towers.test.ts)
- Authentication & Security (AuthGlassReview())
- 3D Visualization & Geometry (tower-gauge-data.ts)
- Dataset Preview & Session Runtime (local-csv.ts)
- Authentication & Security (parseAuthGlassView())
- Authentication & Security (HolographicCoreCanvas())
- 3D Visualization & Geometry (use-scene-motion.ts)
- Domain Module 48 (resource-routing.ts)
- Domain Module 49 (commit())
- 3D Visualization & Geometry (graphics_neon_cube_object_sculpt_spec)
- Authentication & Security (auth-glass.artwork.ts)
- Domain Module 52 (technical-lines.ts)
- Authentication & Security (createAuthGlassGeometry())
- App Shell & Providers (animateExplode())
- 3D Visualization & Geometry (neon-cube.cluster.ts)
- Authentication & Security (auth-glass.backdrop.tsx)
- Domain Module 57 (frame())
- Domain Module 58 (vite-env.d.ts)

## God Nodes (most connected - your core abstractions)
1. `PreviewIcon()` - 60 edges
2. `usePreviewSession()` - 42 edges
3. `createHolographicCoreProductModel()` - 35 edges
4. `ApiError` - 30 edges
5. `HomePreviewView()` - 26 edges
6. `NotificationsPreviewView()` - 24 edges
7. `WorkspacesPreviewView()` - 22 edges
8. `PreviewShell()` - 21 edges
9. `ProjectsPreviewView()` - 20 edges
10. `WorkspaceDetailView()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `failure()` --calls--> `ApiError`  [EXTRACTED]
  __tests__/auth/session-coordinator.test.ts → lib/api-error.ts
- `createRuntime()` --calls--> `createHolographicCoreProductModel()`  [EXTRACTED]
  __tests__/dataset-3d/holographic-towers.test.ts → graphics/holographic-core/holographic-core.model.ts
- `createFixture()` --calls--> `createHolographicCoreProductModel()`  [EXTRACTED]
  __tests__/dataset-3d/inbound-streams.test.ts → graphics/holographic-core/holographic-core.model.ts
- `createFixture()` --calls--> `createHolographicCoreProductModel()`  [EXTRACTED]
  __tests__/dataset-3d/tower-picking.test.ts → graphics/holographic-core/holographic-core.model.ts
- `mount()` --calls--> `createAppRuntime()`  [EXTRACTED]
  __tests__/auth/auth-flow.test.tsx → app/app-runtime.ts

## Import Cycles
- None detected.

## Communities (59 total, 1 thin omitted)

### Community 0 - "Dataset Preview & Session Runtime (ref_node_fs)"
Cohesion: 0.05
Nodes (53): BASELINE, MOMENTS, BASELINE, field(), gapsOf(), buildFingerprint(), describeGeometry(), describeInstancing() (+45 more)

### Community 1 - "3D Visualization & Geometry (holographic-core.decor.tsx)"
Cohesion: 0.06
Nodes (58): CONSTELLATIONS, createAsteroidBelt(), createCelestialGrid(), createConstellations(), createDust(), createOrbitDial(), update(), createPlanet() (+50 more)

### Community 2 - "Dataset Preview & Session Runtime (PreviewSessionModel)"
Cohesion: 0.07
Nodes (54): PreviewSessionModel, DatasetSummary, Person, PreviewDialogRequest, PreviewProjectPanel, PreviewResourceKind, PreviewToast, kindLabels (+46 more)

### Community 3 - "Data Stream & Trajectory Paths (inbound-stream-paths.ts)"
Cohesion: 0.05
Nodes (50): bezierPoint, buildPath(), createInboundPaths(), evaluateBezier(), InboundPath, InboundPathDefinition, LANE_GROUPS, LANE_OFFSETS (+42 more)

### Community 4 - "Reporting & Quality Assessment (PreviewReport)"
Cohesion: 0.06
Nodes (53): PreviewReport, ReportAttachment, ReportFilterTab, ReportIssueType, ReportStatus, WorkspaceOwnershipFilter, WorkspaceRoleFilter, WorkspaceSort (+45 more)

### Community 5 - "Reporting & Quality Assessment (isSettingsNavGroup())"
Cohesion: 0.11
Nodes (50): isSettingsNavGroup(), NotificationFilterTab, CenterView, InboxRow(), NotificationCenter(), QuickRow(), paths, PreviewIcon() (+42 more)

### Community 6 - "Reporting & Quality Assessment (PreviewUniverseNavigator)"
Cohesion: 0.08
Nodes (28): PreviewUniverseNavigator, menuButtonOf(), detailScreen(), listScreen(), openCreate(), openList(), open(), shell() (+20 more)

### Community 7 - "Dataset Preview & Session Runtime (CoverHue)"
Cohesion: 0.09
Nodes (47): CoverHue, DatasetStatus, PreviewMenuOrigin, ProjectFilterTab, TrendStat, WorkspaceStatus, ChartRow, datasetLabels (+39 more)

### Community 8 - "3D Visualization & Geometry (generated-core.ts)"
Cohesion: 0.08
Nodes (41): AttachmentEndpoint, buildExtrudeGeometry(), buildExtrudeShape(), buildLatheGeometry(), clamp01(), clampAlbedoChannel(), clampedAlbedoColor(), clampPbrF0() (+33 more)

### Community 9 - "Dataset Preview & Session Runtime (neon-cube.preview.ts)"
Cohesion: 0.04
Nodes (40): ambientLight, azimuth, bloom, camera, CameraFrame, clayAmbient, clayBackground, clayFill (+32 more)

### Community 10 - "Authentication & Security (App.tsx)"
Cohesion: 0.13
Nodes (26): App(), AppProviders(), Props, AppRuntime, Application(), queryClient, ProtectedRoute(), SessionStatus() (+18 more)

### Community 11 - "Reporting & Quality Assessment (use-preview-session.ts)"
Cohesion: 0.07
Nodes (35): statusLabels, usePreviewStore(), previewMockStore, ActivityEntry, NewProjectDatasetInput, NewProjectInput, NewReportInput, NewWorkspaceInput (+27 more)

### Community 12 - "3D Visualization & Geometry (ProceduralModelRuntime)"
Cohesion: 0.11
Nodes (31): ProceduralModelRuntime, buildHeroColumn(), cellColors(), CAP_REFERENCE, CELL_GAIN, CONTEXT_GAUGES, DIMENSION_LABELS, DIMENSIONS (+23 more)

### Community 13 - "Authentication & Security (auth-provider.tsx)"
Cohesion: 0.13
Nodes (25): AuthProvider(), getUnavailable(), Props, unavailable, composeApiConfig(), DEFAULT_API_TIMEOUT_MS, getApiConfig(), parseApiConfig() (+17 more)

### Community 14 - "Dataset Preview & Session Runtime (app_design_tokens)"
Cohesion: 0.11
Nodes (23): root, rootElement, usePreviewSessionModel(), cleanToken(), is2DPreviewUrl(), normalizePreviewHash(), parsePreviewRoute(), previewHref() (+15 more)

### Community 15 - "3D Visualization & Geometry (neon-cube.model.ts)"
Cohesion: 0.12
Nodes (28): buildCornerMarkers(), buildEdgeFrame(), buildLightSheets(), buildOuterShell(), buildPanes(), buildSeams(), coloredBox(), createBaseOuterGeometry() (+20 more)

### Community 16 - "3D Visualization & Geometry (holographic-core.model.ts)"
Cohesion: 0.13
Nodes (31): addBaseWallGrid(), addCapSolarRays(), addCylinderGrid(), addDeckRecess(), addEdgeRods(), addHotspot(), addPlanarGrid(), addScatteredNodes() (+23 more)

### Community 17 - "Authentication & Security (graphics_auth_glass_auth_glass)"
Cohesion: 0.13
Nodes (21): authGlassConfig, authGlassDebugModes, AuthGlassPanel, AuthGlassView, authGlassViews, Vec3, faceHeight, faceWidth (+13 more)

### Community 18 - "3D Visualization & Geometry (HOLOGRAPHIC_CAMERA)"
Cohesion: 0.16
Nodes (20): HOLOGRAPHIC_CAMERA, CubeLabel(), CubeLabels(), isInsideGlass(), isVisible(), CUBE_LABEL_ASPECT, CUBE_LABEL_LAYOUT, CubeFocus (+12 more)

### Community 19 - "3D Visualization & Geometry (cubeLabelFocusPose())"
Cohesion: 0.12
Nodes (21): cubeLabelFocusPose(), applyCameraPose(), CameraControls(), CameraPose, CoreStructure(), CoreStructureProps, CubeFocusProps, HeroHover (+13 more)

### Community 20 - "3D Visualization & Geometry (createOctagonalTowerGeometry())"
Cohesion: 0.11
Nodes (24): createOctagonalTowerGeometry(), createTowerMaterials(), DETACH_DISTANCE, ORIGINAL_TOWERS, OriginalTower, OUTER_TOWER_IDS, OUTER_TOWERS, OuterTower (+16 more)

### Community 21 - "Dataset Preview & Session Runtime (upload-draft.config.ts)"
Cohesion: 0.16
Nodes (14): UPLOAD_DRAFT_LIMITS, UploadDraftDatabase, createUploadDraftRepository(), Options, sessionError(), storageError(), databases, setup() (+6 more)

### Community 22 - "3D Visualization & Geometry (display-base.tsx)"
Cohesion: 0.20
Nodes (18): DisplayBaseFootlights, displayBaseGlints, DisplayBaseOptions, displayBaseOptions, displayBaseReviewCamera, DisplayBaseTier, DisplayBaseView, displayBaseViews (+10 more)

### Community 23 - "3D Visualization & Geometry (SPOOL_CORE)"
Cohesion: 0.12
Nodes (20): SPOOL_CORE, createSpoolCore(), applyExplode(), applyNucleus(), applyParticles(), reset(), glowTexture(), IDENTITY (+12 more)

### Community 24 - "3D Visualization & Geometry (tower-architecture.ts)"
Cohesion: 0.10
Nodes (23): addTowerCornerPosts(), addTowerDataMarks(), buildCompositeHero(), buildTowerArchitecture(), createBeveledTowerGeometry(), MARK_SEQUENCE, octagonalFootprint(), octagonalRingsGeometry() (+15 more)

### Community 25 - "Reporting & Quality Assessment (preview-mock.service.ts)"
Cohesion: 0.11
Nodes (19): clone(), coverBySeed, createReport(), demoBundle, fixtureSet, listeners, nextReportCode(), patchProject() (+11 more)

### Community 26 - "Authentication & Security (preview-fixtures.ts)"
Cohesion: 0.09
Nodes (19): currentUser, olderAges, olderCovers, olderStatuses, olderWorkspaceSeeds, seedNotificationPrefs, seedNotifications, seedProfile (+11 more)

### Community 27 - "Reporting & Quality Assessment (core-visual-config.ts)"
Cohesion: 0.14
Nodes (17): CLEAN_LOOP_POINTS, CORE_GLOW_V2, CORE_GLOW_V3, CORE_NUCLEUS_V3, CORE_NUCLEUS_V4, CORE_VISUAL_REVISION, CoreGlowEntry, CoreVisualRevision (+9 more)

### Community 28 - "3D Visualization & Geometry (connection-geometry.ts)"
Cohesion: 0.24
Nodes (16): hubSocketWall(), triangle(), socketPanel(), AnnularPart(), DatasetCartridge(), Finish, FinishMaterial(), noPorts (+8 more)

### Community 29 - "Dataset Preview & Session Runtime (resource-camera-controller.tsx)"
Cohesion: 0.24
Nodes (16): Props, ResourceCameraController(), Transition, CameraPose, clampTarget(), fitPose(), nodeCorners(), overviewDirection() (+8 more)

### Community 30 - "Dataset Preview & Session Runtime (people)"
Cohesion: 0.10
Nodes (15): people, fixtureSets, manyProjects(), manyWorkspaces(), oneProject, oneWorkspace, PreviewFixtureSet, PreviewFixtureSetId (+7 more)

### Community 31 - "Authentication & Security (previewNavigateEvent)"
Cohesion: 0.18
Nodes (18): previewNavigateEvent, PreviewActionId, PreviewMenuRequest, PreviewSurfaceSide, ContextMenuSurface(), InfoHoverHandlers, PreviewContextMenu(), PopoverSurface() (+10 more)

### Community 32 - "3D Visualization & Geometry (assets_8da_ai_network_logo)"
Cohesion: 0.17
Nodes (15): connectionRadius(), advanceFlow(), layoutResources(), arrange(), place(), resourceTrail(), validateResources(), Validation (+7 more)

### Community 33 - "Reporting & Quality Assessment (resolveCoreNucleus())"
Cohesion: 0.14
Nodes (19): resolveCoreNucleus(), Vec3, BeadSeed, buildLaneSamples(), CORE_NUCLEUS, createGlowTexture(), createIssueConstellation(), applyBeacon() (+11 more)

### Community 34 - "Test Suite & Mocks (hardware-lighting.tsx)"
Cohesion: 0.18
Nodes (12): attachEnvironment(), HardwareLighting(), DataPipe(), Props, ResourceScene(), SceneBoundary, SceneController(), resourceLabelBudget() (+4 more)

### Community 35 - "Authentication & Security (auth-context.ts)"
Cohesion: 0.21
Nodes (14): AuthContext, AuthContextValue, isLoginResponse(), isNonemptyString(), mapLoginResponse(), LoginRequestDto, LoginResponseDto, LoginResult (+6 more)

### Community 36 - "Authentication & Security (app-runtime.ts)"
Cohesion: 0.24
Nodes (12): ClientOptions, createAppRuntime(), RuntimeOptions, createAxiosClient(), createAuthService(), createHealthService(), createUsersService(), accessToken() (+4 more)

### Community 37 - "Dataset Preview & Session Runtime (session-storage.ts)"
Cohesion: 0.26
Nodes (13): createSessionStorage(), SESSION_STORAGE_KEY, SessionStorageOptions, validateSession(), session(), setup(), token(), AccessTokenInfo (+5 more)

### Community 38 - "Authentication & Security (session-coordinator.ts)"
Cohesion: 0.21
Nodes (12): createSessionCoordinator(), safeError(), sessionError(), failure(), loginResult(), profile(), session(), setup() (+4 more)

### Community 39 - "3D Visualization & Geometry (TOWER_IDS)"
Cohesion: 0.15
Nodes (12): TOWER_IDS, canvasProbe, FIXTURE, createFixture(), dropRay(), firstPick(), ModelApi, TowerRuntime (+4 more)

### Community 40 - "Dataset Preview & Session Runtime (preview-worst-case.test.tsx)"
Cohesion: 0.35
Nodes (13): frameText(), renderAllFrames(), Project, StatusBadge(), InfoSurface(), formatCount(), formatDataSize(), formatRows() (+5 more)

### Community 41 - "3D Visualization & Geometry (holographic-towers.test.ts)"
Cohesion: 0.16
Nodes (14): ALL_IDS, BASE_Y, boundingSize(), clearance(), createRuntime(), footprintHalf(), HERO_IDS, innerFace() (+6 more)

### Community 42 - "Authentication & Security (AuthGlassReview())"
Cohesion: 0.19
Nodes (9): AuthGlassReview(), AuthGlassStage(), endDrag(), openPanel(), focusPanelField(), GlassFallback(), GlassScene(), GlassSceneBoundary (+1 more)

### Community 43 - "3D Visualization & Geometry (tower-gauge-data.ts)"
Cohesion: 0.26
Nodes (11): bucketBottoms(), bucketTops(), deriveCells(), litCount(), mismatchIndices(), MOCK_SCOPES, MOCK_SCORES, DimensionScore (+3 more)

### Community 44 - "Dataset Preview & Session Runtime (local-csv.ts)"
Cohesion: 0.33
Nodes (5): localCsvResources(), parseLocalCsv(), LocalCsvDocument, LocalCsvViewer(), Workspace3DPreview()

### Community 45 - "Authentication & Security (parseAuthGlassView())"
Cohesion: 0.31
Nodes (8): parseAuthGlassView(), parseDisplayBaseView(), useLogin(), AuthGlassReview, AuthGlassStage, DataVerseMark(), DisplayBaseReview, LoginView()

### Community 46 - "Authentication & Security (HolographicCoreCanvas())"
Cohesion: 0.24
Nodes (6): HolographicCoreCanvas(), SceneBoundary, Dataset3DView(), formatDimensions(), MODULE_THEMES, useReducedMotion()

### Community 47 - "3D Visualization & Geometry (use-scene-motion.ts)"
Cohesion: 0.29
Nodes (8): hidden(), reduced(), serverReduced(), subscribeMotion(), subscribeVisibility(), useSceneMotion(), sceneProbe, CameraCommand

### Community 48 - "Domain Module 48 (resource-routing.ts)"
Cohesion: 0.36
Nodes (8): offset(), routeResources(), world(), Point3, PositionedResource, ResourceLayout, ResourcePort, ResourceRoute

### Community 49 - "Domain Module 49 (commit())"
Cohesion: 0.24
Nodes (10): commit(), createProject(), createWorkspace(), delay(), markRead(), nowStamp(), pad2(), removeMany() (+2 more)

### Community 50 - "3D Visualization & Geometry (graphics_neon_cube_object_sculpt_spec)"
Cohesion: 0.22
Nodes (7): components, materials, repetitions, spec, SpecComponent, SpecMaterial, SpecRepetition

### Community 51 - "Authentication & Security (auth-glass.artwork.ts)"
Cohesion: 0.54
Nodes (7): createAuthArtwork(), field(), logo(), PanelKind, roundedRect(), social(), text()

### Community 52 - "Domain Module 52 (technical-lines.ts)"
Cohesion: 0.29
Nodes (6): CYAN, ROD_UP, rodDirection, rodMidpoint, rodQuaternion, rodScale

### Community 53 - "Authentication & Security (createAuthGlassGeometry())"
Cohesion: 0.33
Nodes (3): createAuthGlassGeometry(), BaseReviewScene(), DisplayBaseReview()

### Community 54 - "App Shell & Providers (animateExplode())"
Cohesion: 0.40
Nodes (6): animateExplode(), step(), applyExplode(), measureExplodedFrame(), resetView(), updateViewLabel()

### Community 55 - "3D Visualization & Geometry (neon-cube.cluster.ts)"
Cohesion: 0.40
Nodes (4): NEON_CUBE_CLUSTER_LAYOUT, NeonCubeCluster, NeonCubeClusterNode, NeonCubeModel

### Community 56 - "Authentication & Security (auth-glass.backdrop.tsx)"
Cohesion: 0.83
Nodes (3): AuthGlassBackdrop(), createPatternTexture(), createAuthBackdropMaterial()

### Community 57 - "Domain Module 57 (frame())"
Cohesion: 0.83
Nodes (4): frame(), renderStatus(), setClay(), setExploded()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createHolographicCoreProductModel()` connect `3D Visualization & Geometry (holographic-core.model.ts)` to `Dataset Preview & Session Runtime (ref_node_fs)`, `Reporting & Quality Assessment (resolveCoreNucleus())`, `Data Stream & Trajectory Paths (inbound-stream-paths.ts)`, `3D Visualization & Geometry (TOWER_IDS)`, `3D Visualization & Geometry (generated-core.ts)`, `3D Visualization & Geometry (holographic-towers.test.ts)`, `3D Visualization & Geometry (ProceduralModelRuntime)`, `3D Visualization & Geometry (cubeLabelFocusPose())`, `3D Visualization & Geometry (createOctagonalTowerGeometry())`, `3D Visualization & Geometry (SPOOL_CORE)`, `Reporting & Quality Assessment (core-visual-config.ts)`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `Dataset Preview & Session Runtime (ref_node_fs)` be split into smaller, more focused modules?**
  _Cohesion score 0.052884615384615384 - nodes in this community are weakly interconnected._
- **Why does `PreviewIcon()` connect `Reporting & Quality Assessment (isSettingsNavGroup())` to `Dataset Preview & Session Runtime (PreviewSessionModel)`, `Reporting & Quality Assessment (PreviewReport)`, `Dataset Preview & Session Runtime (CoverHue)`, `Dataset Preview & Session Runtime (preview-worst-case.test.tsx)`, `Authentication & Security (previewNavigateEvent)`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `3D Visualization & Geometry (holographic-core.decor.tsx)` be split into smaller, more focused modules?**
  _Cohesion score 0.05632360471070148 - nodes in this community are weakly interconnected._
- **Why does `createSpoolCore()` connect `3D Visualization & Geometry (SPOOL_CORE)` to `3D Visualization & Geometry (holographic-core.model.ts)`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `Dataset Preview & Session Runtime (PreviewSessionModel)` be split into smaller, more focused modules?**
  _Cohesion score 0.07033315705975675 - nodes in this community are weakly interconnected._
- **Should `Data Stream & Trajectory Paths (inbound-stream-paths.ts)` be split into smaller, more focused modules?**
  _Cohesion score 0.05028248587570622 - nodes in this community are weakly interconnected._