/**
 * LINEスタンプ プロンプトメーカー - メインロジック
 *
 * このファイルは画面の動作を全て管理する。
 * 外部ライブラリは一切使わず、素のJavaScriptのみで実装。
 * ローカルで index.html を開くだけで動作する。
 */

/* =====================================================
 * アプリの状態（ユーザーが選んだ内容を記録する）
 * ===================================================== */
const appState = {
  images: [],              // アップロードされた画像（File オブジェクト）
  consent: false,          // 権利同意チェックボックスの状態
  personCount: null,       // 登場人数（"1" / "2" / "3"）
  relationship: null,      // 関係性（"parent_child" など。2名以上のときのみ必須）
  conversionType: null,    // 変換タイプ（"character" など）
  usage: null,             // 用途カテゴリ（"greeting" など）
  designStyle: null,       // デザイン系統（"illustration" など）
  brotherPresetOn: false,  // 兄弟スタンプ（固定スタイル）プリセットのON/OFF
  // ── 新規追加フィールド（UIから更新されるまでは既定値で動作）──
  totalCount: "32",        // 生成枚数（TOTAL_COUNTS の value）
  gridLayout: "1",         // まとめ方（GRID_LAYOUTS の value。"1"=個別）
  background: "green",     // 背景種別（BACKGROUNDS の value）
  font: "marugo",          // フォント種別（FONTS の value）
  textColor: "brown_cream",// 文字色種別（TEXT_COLORS の value）
};

/* =====================================================
 * 背景・フォント・文字色のヘルパー関数
 * appState の値から対応するオブジェクトを取得する。
 * 見つからない場合は配列の先頭にフォールバックする。
 * ===================================================== */

/** 現在選択中の背景オブジェクトを返す */
function getBg() {
  return BACKGROUNDS.find((b) => b.value === appState.background) || BACKGROUNDS[0];
}

/** 現在選択中のフォントオブジェクトを返す */
function getFont() {
  return FONTS.find((f) => f.value === appState.font) || FONTS[0];
}

/** 現在選択中の文字色オブジェクトを返す */
function getTextColor() {
  return TEXT_COLORS.find((c) => c.value === appState.textColor) || TEXT_COLORS[0];
}

/**
 * 背景と文字色が同系色で視認性が下がるコンビかどうかを返す
 * ・クロマキーグリーン × ティールグリーン文字
 * ・ブラック × 黒文字
 * ・ホワイト × 白文字
 * @returns {boolean}
 */
function isContrastClash() {
  const bg  = appState.background;
  const col = appState.textColor;
  return (
    (bg === "green"  && col === "teal_white")  ||
    (bg === "black"  && col === "black_white") ||
    (bg === "white"  && col === "white_black")
  );
}

/* =====================================================
 * 初期化処理（ページ読み込み完了後に実行）
 * ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 各セクションのUI部品を生成・配置する
  buildPersonCountSection();     // 登場人数（新規）
  buildRelationshipSection();    // 関係性（新規・初期は非表示）
  buildConversionTypeSection();
  buildUsageSection();
  buildDesignStyleSection();

  // ── 新規5セクション ──
  // 総スタンプ数・まとめ方・背景・フォント・文字色
  buildCardGroup("totalCountCards", "totalCount", TOTAL_COUNTS, "totalCount");
  buildCardGroup("gridLayoutCards", "gridLayout", GRID_LAYOUTS, "gridLayout");
  // 背景と文字色はコントラスト警告コールバック付き
  buildCardGroup("backgroundCards", "background", BACKGROUNDS, "background", updateContrastWarning);
  buildCardGroup("fontCards",       "font",        FONTS,        "font");
  buildCardGroup("textColorCards",  "textColor",   TEXT_COLORS,  "textColor", updateContrastWarning);

  // 各カード群の既定値をUIに反映（ページ読み込み直後も選択済みに見えるように）
  setInitialCardSelection("totalCountCards", "totalCount", appState.totalCount);
  setInitialCardSelection("gridLayoutCards", "gridLayout", appState.gridLayout);
  setInitialCardSelection("backgroundCards", "background", appState.background);
  setInitialCardSelection("fontCards",       "font",       appState.font);
  setInitialCardSelection("textColorCards",  "textColor",  appState.textColor);

  // 初回のコントラスト警告チェック
  updateContrastWarning();

  // 関係性セクションは初期状態で非表示にする
  const relSection = document.getElementById("stepRelationship");
  if (relSection) relSection.style.display = "none";

  // 画像アップロードの設定
  setupImageUpload();

  // 同意チェックボックスの設定
  setupConsentCheckbox();

  // 生成ボタンの設定
  setupGenerateButton();

  // 初期状態でボタンの有効/無効を確認
  updateGenerateButtonState();

  // マスター・シート①②・一括コピーボタンのイベントを DOMContentLoaded 内で登録
  // オプショナルチェーン（?.）で要素が null の場合のエラーを防ぐ
  document.getElementById("masterCopyBtn")?.addEventListener("click", copyMasterPrompt);
  document.getElementById("sheet1CopyBtn")?.addEventListener("click", copySheet1Prompt);
  document.getElementById("bulkCopyBtn")?.addEventListener("click", copyAllPrompts);

  // 兄弟スタンプ（固定スタイル）プリセットの初期設定
  setupBrotherPreset();
});

/* =====================================================
 * 画像アップロード機能
 * ===================================================== */
function setupImageUpload() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const previewArea = document.getElementById("imagePreview");

  // ドロップゾーンクリックでファイル選択ダイアログを開く
  dropZone.addEventListener("click", () => fileInput.click());

  // Enter / Space キーでもファイル選択ダイアログを開けるようにする
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // スペースのページスクロールを防ぐ
      fileInput.click();
    }
  });

  // 入室カウンタ方式で dragleave のちらつきを防ぐ
  let dragEnterCounter = 0;

  dropZone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragEnterCounter++;
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault(); // ドロップを有効化するために必須
  });

  dropZone.addEventListener("dragleave", () => {
    dragEnterCounter--;
    if (dragEnterCounter === 0) {
      dropZone.classList.remove("drag-over");
    }
  });

  // ファイルをドロップしたとき
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dragEnterCounter = 0;
    dropZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  // ファイル選択ダイアログで選んだとき
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    // 同じファイルを再選択できるようにリセット
    fileInput.value = "";
  });
}

/**
 * アップロードされたファイルを処理する
 * @param {FileList} files - 選択されたファイルのリスト
 */
function handleFiles(files) {
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));

  // 合計3枚を超えた場合は警告
  const remaining = 3 - appState.images.length;
  if (remaining <= 0) {
    showAlert("画像は最大3枚までです。削除してから追加してください。");
    return;
  }
  const toAdd = imageFiles.slice(0, remaining);
  if (imageFiles.length > remaining) {
    showAlert(`最大3枚まで追加できます。${remaining}枚のみ追加しました。`);
  }

  // 各ファイルをプレビュー表示する
  toAdd.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgData = { file, dataUrl: e.target.result };
      appState.images.push(imgData);
      renderImagePreview();
      updateGenerateButtonState();
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 画像プレビューエリアを再描画する
 */
function renderImagePreview() {
  const previewArea = document.getElementById("imagePreview");
  const imageCountMsg = document.getElementById("imageCountMsg");

  previewArea.innerHTML = "";

  appState.images.forEach((imgData, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-thumb";

    const img = document.createElement("img");
    img.src = imgData.dataUrl;
    img.alt = `参照画像 ${index + 1}`;

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "thumb-delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", `画像${index + 1}を削除`);
    deleteBtn.addEventListener("click", () => {
      appState.images.splice(index, 1);
      renderImagePreview();
      updateGenerateButtonState();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(deleteBtn);
    previewArea.appendChild(wrapper);
  });

  // 枚数カウント表示
  if (imageCountMsg) {
    imageCountMsg.textContent =
      appState.images.length > 0
        ? `${appState.images.length}枚選択中（最大3枚）`
        : "画像が選択されていません";
  }
}

/* =====================================================
 * 同意チェックボックス
 * ===================================================== */
function setupConsentCheckbox() {
  const checkbox = document.getElementById("consentCheck");
  if (!checkbox) return;
  checkbox.addEventListener("change", () => {
    appState.consent = checkbox.checked;
    updateGenerateButtonState();
  });
}

/* =====================================================
 * 選択肢カードの生成ユーティリティ
 * ===================================================== */

/**
 * カード選択UIを生成してコンテナに追加する
 * @param {string}   containerId - 挿入先のコンテナ要素のID
 * @param {string}   groupName   - ラジオボタンのname属性
 * @param {Array}    options     - 選択肢の配列
 * @param {string}   stateKey    - appState に保存するキー名
 * @param {Function} [onChange]  - 選択変更時に追加で呼ぶコールバック（省略可）
 */
function buildCardGroup(containerId, groupName, options, stateKey, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "option-card";
    label.htmlFor = `${groupName}-${opt.value}`;

    // 隠しラジオボタン（アクセシビリティのため）
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.id = `${groupName}-${opt.value}`;
    radio.value = opt.value;

    // カード本体のコンテンツ
    const content = document.createElement("div");
    content.className = "card-content";

    const icon = document.createElement("div");
    icon.className = "card-icon";
    icon.textContent = opt.icon;

    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = opt.label;

    const descEl = document.createElement("div");
    descEl.className = "card-desc";
    descEl.textContent = opt.desc;

    // フォントのサンプル表示（sampleStyle が定義されているカード）
    if (opt.sampleStyle) {
      const sample = document.createElement("div");
      sample.className = "font-sample";
      sample.textContent = "あいうえお ABC";
      sample.setAttribute("style", opt.sampleStyle);
      content.appendChild(icon);
      content.appendChild(titleEl);
      content.appendChild(sample);
      content.appendChild(descEl);
    } else if (Object.prototype.hasOwnProperty.call(opt, "swatch")) {
      // 色見本がある場合（背景・文字色カード）
      // swatch が null の場合は透過チェッカー柄、文字列の場合はその色で表示する
      const swatchEl = document.createElement("span");
      if (opt.swatch === null) {
        swatchEl.className = "card-swatch card-swatch--transparent";
        swatchEl.title = "透過（背景なし）";
      } else {
        swatchEl.className = "card-swatch";
        swatchEl.style.backgroundColor = opt.swatch;
        // 白や明るい色は枠線で区別する
        if (opt.swatch === "#FFFFFF") {
          swatchEl.style.border = "1px solid #C8D0DA";
        }
      }
      content.appendChild(icon);
      content.appendChild(titleEl);
      content.appendChild(swatchEl);
      content.appendChild(descEl);
    } else {
      content.appendChild(icon);
      content.appendChild(titleEl);
      content.appendChild(descEl);
    }

    label.appendChild(radio);
    label.appendChild(content);

    // 選択されたとき状態を更新
    radio.addEventListener("change", () => {
      appState[stateKey] = opt.value;
      // 選択済みのビジュアル更新
      container.querySelectorAll(".option-card").forEach((c) => c.classList.remove("selected"));
      label.classList.add("selected");
      updateGenerateButtonState();
      // 追加コールバックがあれば呼ぶ
      if (onChange) onChange(opt.value);
    });

    container.appendChild(label);
  });
}

/* =====================================================
 * 登場人数セクション（新規追加）
 * ===================================================== */

// 登場人数の選択肢を生成する
function buildPersonCountSection() {
  buildCardGroup(
    "personCountCards",
    "personCount",
    PERSON_COUNTS,
    "personCount",
    handlePersonCountChange  // 選択変更時に関係性セクションの表示/非表示を切り替える
  );
}

/**
 * 登場人数が変更されたときに呼ばれる
 * 2名以上のときは関係性セクションを表示する
 * @param {string} value - 選択された人数（"1"/"2"/"3"）
 */
function handlePersonCountChange(value) {
  const relSection = document.getElementById("stepRelationship");
  if (!relSection) return;

  const isMultiple = parseInt(value, 10) >= 2;

  if (isMultiple) {
    // 2名以上 → 関係性セクションを表示する
    relSection.style.display = "block";
  } else {
    // 1名 → 関係性セクションを非表示にしてリセットする
    relSection.style.display = "none";
    appState.relationship = null;
    document.querySelectorAll('[name="relationship"]').forEach((r) => {
      r.checked = false;
    });
    document.querySelectorAll("#relationshipCards .option-card").forEach((c) => {
      c.classList.remove("selected");
    });
    updateGenerateButtonState();
  }
}

/* =====================================================
 * 関係性セクション（新規追加）
 * ===================================================== */

// 関係性の選択肢を生成する（初期は非表示、CSS または JS で制御）
function buildRelationshipSection() {
  buildCardGroup("relationshipCards", "relationship", RELATIONSHIPS, "relationship");
}

/* =====================================================
 * その他の選択肢セクション
 * ===================================================== */

// 変換タイプの選択肢を生成
function buildConversionTypeSection() {
  buildCardGroup("conversionTypeCards", "conversionType", CONVERSION_TYPES, "conversionType");
}

// 用途カテゴリの選択肢を生成
function buildUsageSection() {
  buildCardGroup("usageCards", "usage", USAGE_CATEGORIES, "usage");
}

// デザイン系統の選択肢を生成
function buildDesignStyleSection() {
  buildCardGroup("designStyleCards", "designStyle", DESIGN_STYLES, "designStyle");
}

/**
 * カード群の既定値を UI に反映するヘルパー
 * buildCardGroup 直後に呼ぶことで、ページ初期表示でも選択済みカードが見える
 * @param {string} containerId - コンテナ要素のID
 * @param {string} groupName   - ラジオボタンの name 属性
 * @param {string} defaultVal  - appState の既定値（初期選択したい value）
 */
function setInitialCardSelection(containerId, groupName, defaultVal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // 既定値に対応するラジオボタンを探す
  const radio = container.querySelector(`[name="${groupName}"][value="${defaultVal}"]`);
  if (!radio) return;
  radio.checked = true;
  // 親の .option-card に selected クラスを付与する
  const card = radio.closest(".option-card");
  if (card) card.classList.add("selected");
}

/**
 * 背景と文字色のコントラストが同系色かどうかを判定して警告を表示・非表示にする
 * 背景カードまたは文字色カードが変更されるたびに呼ばれる（onChange コールバック）。
 * DOMContentLoaded 時にも初回呼び出しする。
 */
function updateContrastWarning() {
  const el = document.getElementById("contrastWarning");
  if (!el) return;
  if (isContrastClash()) {
    el.textContent =
      "⚠️ 背景と文字色が同系色です。読みにくい／透過しにくい可能性があります";
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

/* =====================================================
 * 生成ボタンの制御
 * ===================================================== */
function setupGenerateButton() {
  const btn = document.getElementById("generateBtn");
  if (!btn) return;
  btn.addEventListener("click", handleGenerate);
}

/**
 * 全条件が揃っているかチェックして生成ボタンの状態を更新する
 * ─ プリセットON時：画像 ≥ 1 枚 & 同意チェック のみ必須
 * ─ 通常モード：画像≥1 / 同意 / 人数 / （2名以上なら関係） / 変換タイプ / 用途 / デザイン / フォント
 */
function updateGenerateButtonState() {
  const btn = document.getElementById("generateBtn");
  if (!btn) return;

  const hintEl  = document.getElementById("generateHint");
  let   isReady = false;

  if (appState.brotherPresetOn) {
    // ─── プリセットON時：画像 ≥ 1 & 同意 のみ確認 ───
    isReady = appState.images.length >= 1 && appState.consent;

    if (hintEl) {
      if (isReady) {
        hintEl.textContent = "すべての設定が完了しました！生成ボタンを押してください。";
        hintEl.className   = "generate-hint ready";
      } else {
        const missing = [];
        if (appState.images.length === 0) missing.push("参照画像のアップロード");
        if (!appState.consent)            missing.push("権利確認チェックボックス");
        hintEl.textContent = "未完了：" + missing.join("、");
        hintEl.className   = "generate-hint pending";
      }
    }
  } else {
    // ─── 通常モード：既存の全条件チェック ───
    const personCountNum       = parseInt(appState.personCount, 10) || 0;
    const relationshipRequired = personCountNum >= 2;

    // フォント・背景・文字色・総数・まとめ方は既定値あり → 必須チェックに含めない
    isReady =
      appState.images.length >= 1 &&
      appState.consent &&
      appState.personCount !== null &&
      (!relationshipRequired || appState.relationship !== null) &&
      appState.conversionType !== null &&
      appState.usage !== null &&
      appState.designStyle !== null;

    if (hintEl) {
      if (isReady) {
        hintEl.textContent = "すべての設定が完了しました！生成ボタンを押してください。";
        hintEl.className   = "generate-hint ready";
      } else {
        const missing = [];
        if (appState.images.length === 0) missing.push("参照画像のアップロード");
        if (!appState.consent)            missing.push("権利確認チェックボックス");
        if (!appState.personCount)        missing.push("登場人数");
        if (relationshipRequired && !appState.relationship) missing.push("関係");
        if (!appState.conversionType)     missing.push("変換タイプ");
        if (!appState.usage)              missing.push("用途");
        if (!appState.designStyle)        missing.push("デザイン系統");
        hintEl.textContent = "未完了：" + missing.join("、");
        hintEl.className   = "generate-hint pending";
      }
    }
  }

  btn.disabled = !isReady;
}

/* =====================================================
 * プロンプト生成処理（アプリの核心機能）
 * ===================================================== */
function handleGenerate() {
  // 総数とグリッドレイアウトを appState から取得する（両モード共通）
  const grid  = GRID_LAYOUTS.find((g) => g.value === appState.gridLayout) || GRID_LAYOUTS[0];
  const total = parseInt(appState.totalCount, 10) || 32;

  // ── 兄弟スタンプ（固定スタイル）プリセット ON のフロー ──
  if (appState.brotherPresetOn) {
    const masterPrompt = buildBrotherMasterPrompt();

    if (grid.perImage === 1) {
      // 個別モード：total 個の個別プロンプトを生成してシートは空配列で渡す
      const individualPrompts = buildBrotherIndividualPrompts(total);
      renderResults(masterPrompt, individualPrompts, []);
    } else {
      // シートモード：兄弟スタンプ専用シートプロンプトを生成する
      const sheetArray = buildBrotherSheetPrompts(total, grid.cols, grid.perImage);
      renderResults(masterPrompt, [], sheetArray);
    }
    document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
    return;
  }

  // ── 通常モード：選んだ設定のオブジェクトを取得する ──
  const convType   = CONVERSION_TYPES.find((c) => c.value === appState.conversionType);
  const usageCat   = USAGE_CATEGORIES.find((u) => u.value === appState.usage);
  const design     = DESIGN_STYLES.find((d) => d.value === appState.designStyle);
  // フォントは appState.font から getFont() で取得（旧 FONT_STYLES/fontStyle は廃止）
  const font       = getFont();
  const relObj     = RELATIONSHIPS.find((r) => r.value === appState.relationship) || null;

  // find() が undefined を返した場合（データ定義ミス等）は早期リターンする
  if (!convType || !usageCat || !design) return;

  // 用途に対応するスタンプ文言リストを取得する
  const wordList = STAMP_DATA[usageCat.dataKey];

  // wordList が取得できない場合はエラーを表示して処理を中断する
  if (!wordList) {
    showAlert(
      `データの取得に失敗しました（キー: ${usageCat.dataKey}）。` +
      "ページを再読み込みして、もう一度お試しください。"
    );
    return;
  }

  // --- (A) マスタープロンプトを生成する ---
  const masterPrompt = buildMasterPrompt(
    convType, design, font,
    appState.images.length, appState.personCount, relObj
  );

  if (grid.perImage === 1) {
    // --- (B-1) 個別モード：total 個の個別プロンプトを生成し、シートは空配列で渡す ---
    const individualPrompts = buildIndividualPrompts(
      wordList, convType, design, font,
      appState.personCount, relObj, total
    );
    renderResults(masterPrompt, individualPrompts, []);
  } else {
    // --- (B-2) シートモード：Math.ceil(total/perImage) 枚のシートプロンプト配列を生成する ---
    const sheetArray = buildSheetPrompts(
      wordList, convType, design, font,
      appState.personCount, relObj, total, grid.cols, grid.perImage
    );
    renderResults(masterPrompt, [], sheetArray);
  }

  // 結果エリアまでスムーズスクロールする
  document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
}

/**
 * マスタープロンプト（キャラ固定用の最初の1個）を生成する
 * @param {Object}      convType    - 変換タイプオブジェクト
 * @param {Object}      design      - デザイン系統オブジェクト
 * @param {Object}      font        - フォント感オブジェクト
 * @param {number}      imageCount  - アップロード画像枚数
 * @param {string}      personCount - 登場人数（"1"/"2"/"3"）
 * @param {Object|null} relObj      - 関係性オブジェクト（1名のときは null）
 */
function buildMasterPrompt(convType, design, font, imageCount, personCount, relObj) {
  const personCountNum = parseInt(personCount, 10) || 1;

  // 参照画像の説明文を人数に合わせて変える
  let imageText;
  if (imageCount === 1) {
    imageText = "添付した参照画像（1枚）";
  } else if (personCountNum === 1) {
    imageText = `添付した参照画像（${imageCount}枚、同一人物の異なるアングル）`;
  } else {
    imageText = `添付した参照画像（${imageCount}枚）`;
  }

  // 登場人数のセクション文言を組み立てる
  let personSection = "";
  if (personCountNum === 1) {
    personSection =
      `登場人数：1名\n` +
      `参照画像に映っている人物1名をキャラクター化する。\n` +
      `全スタンプを通じてこの1名を一貫して描くこと。`;
  } else {
    // 2名/3名の場合
    const relationLabel = relObj ? relObj.label : "不問";
    const relationDesc  = relObj ? relObj.masterDesc : "自然な関係として描く。状況に合った自然な絡みややりとりを表現する";

    // 全員強制ではなく「シーンに自然な人数」を登場させる方針に変更
    personSection =
      `登場人数：${personCountNum}名\n` +
      `参照画像から人物${personCountNum}名分のキャラクターを作成する。\n` +
      `参照画像の枚数がキャラクター数と一致しない場合でも、` +
      `画像に映っている人物から${personCountNum}名分を読み取ってキャラクターを固定すること。\n\n` +
      `関係性：${relationLabel}\n\n` +
      `登場しうるのは最大${personCountNum}名。各スタンプのセリフ・シーンに最も自然な人数だけを登場させること。\n` +
      `1人が自然な場面は1人だけ、掛け合いが自然な場面は2名以上を登場させてよい。\n` +
      `2名以上が登場するスタンプでは、${relationDesc}。\n` +
      `どのキャラクターを描く場合も、外見（顔・髪・服・体型・配色）は固定したまま描くこと。`;
  }

  // LINEスタンプ規格の枠数の説明（人数に応じて変える）
  // 2名以上はシーンに自然な人数（1〜最大人数）を指定する
  const stampCountRule =
    personCountNum === 1
      ? "・1枚につき1キャラクターのみ描くこと"
      : `・1枚につきセリフ・シーンに最も自然な人数（1〜${personCountNum}名の範囲）で描くこと`;

  return `【マスタープロンプト：キャラクター設定の固定】

${imageText}を参照して、LINEスタンプ用のキャラクターを以下の指示に従って生成してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 登場人数・関係性の設定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${personSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ キャラクター固定ルール（最優先・絶対厳守）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
参照画像に映っているすべての人物の以下の要素を完全に固定し、
これから生成するすべての画像で一切変えないこと：

・顔立ち（目の形・大きさ、鼻・口・輪郭の形）
・髪型（長さ・流れ・スタイル）と髪の色
・体型・プロポーション
・服装・衣装の色とデザイン
・キャラクター全体の雰囲気・個性

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 変換スタイル
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${convType.promptText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ アートスタイル
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${design.promptText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ LINEスタンプ規格（必ず守ること）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・正方形（縦横 1:1 の比率）で生成すること
・${getBg().promptText}
・キャラクターを画面中央に大きく配置し、
　上下左右に約 10% の余白を設けること
${stampCountRule}
・文字はキャラクターの下部または周辺に
　自然になじむように配置すること

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 文字・フォント指定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
スタンプ内のセリフ・文字は以下で表現すること：
「セリフ」を〔${getFont().promptText}〕で表示、色は〔${getTextColor().promptText}〕

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ シリーズ制作の宣言
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
これからこのキャラクターで合計 ${parseInt(appState.totalCount, 10) || 32} 枚のスタンプを
順番に生成します。

表情・ポーズ・セリフは各スタンプで変わりますが、
キャラクターの外見（顔・髪・服・体型・配色）は
絶対に変えないでください。

各プロンプトを受け取ったら、必ずこのマスター設定を
参照してからキャラクターを描いてください。
キャラクターの一貫性がこのシリーズの最重要事項です。`;
}

/**
 * 32個の個別プロンプトを生成する（wordList の先頭32件を使用）
 * @param {Array}       wordList    - スタンプ文言と表情ヒントの配列
 * @param {Object}      convType    - 変換タイプオブジェクト
 * @param {Object}      design      - デザイン系統オブジェクト
 * @param {Object}      font        - フォント感オブジェクト
 * @param {string}      personCount - 登場人数（"1"/"2"/"3"）
 * @param {Object|null} relObj      - 関係性オブジェクト（1名のときは null）
 * @param {number}      [totalCount] - 生成枚数（省略時は appState.totalCount を参照）
 * @returns {string[]} 指定枚数分のプロンプト文字列の配列
 */
function buildIndividualPrompts(wordList, convType, design, font, personCount, relObj, totalCount) {
  const personCountNum = parseInt(personCount, 10) || 1;
  // totalCount が渡されなければ appState の値を使う
  const count = totalCount || parseInt(appState.totalCount, 10) || 32;

  // wordList が count 個未満の場合は開発者向け警告を出す（サイレント減数の防止）
  if (wordList.length < count) {
    console.warn(
      `[LINEスタンプメーカー] wordList が${count}個未満です（現在 ${wordList.length} 個）。` +
      "data.js の該当カテゴリを確認してください。"
    );
  }

  const prompts = [];
  const total = Math.min(wordList.length, count);

  for (let i = 0; i < total; i++) {
    const item = wordList[i];
    const num  = String(i + 1).padStart(2, "0");

    // 簡潔なスタイルタグ（背景・フォント・文字色を appState から取得して付ける）
    const styleTag = `（${design.label}・${getBg().label}・正方形）`;

    // 2名以上のときは「シーンに自然な人数」と絡み方ヒントを条件付きで追加する
    let interactionLine = "";
    if (personCountNum >= 2 && relObj) {
      interactionLine =
        `\n・登場人数：このセリフ・シーンに最も自然な人数（1〜${personCountNum}名）で描くこと。` +
        `2名以上が登場する場合は${relObj.interactionHint}`;
    }

    const prompt =
      `【スタンプ${num}】\n` +
      `上のマスタープロンプトのキャラクター設定に従い、以下の1枚を生成してください。\n` +
      `・表情とポーズ：${item.pose}${interactionLine}\n` +
      `・セリフ：「${item.text}」を〔${getFont().promptText}〕で表示、色は〔${getTextColor().promptText}〕\n` +
      `・スタイル${styleTag}`;

    prompts.push(prompt);
  }

  return prompts;
}

/**
 * 指定枚数のスタンプを cols×cols グリッドのシートにまとめたプロンプト配列を生成する。
 * 旧来の固定2枚（4×4×16）から可変枚数・可変グリッドサイズに一般化。
 *
 * @param {Array}       wordList    - スタンプ文言と表情ヒントの配列
 * @param {Object}      convType    - 変換タイプオブジェクト
 * @param {Object}      design      - デザイン系統オブジェクト
 * @param {Object}      font        - フォント感オブジェクト（旧互換用：UI未統合の間使用）
 * @param {string}      personCount - 登場人数（"1"/"2"/"3"）
 * @param {Object|null} relObj      - 関係性オブジェクト（1名のときは null）
 * @param {number}      totalCount  - 生成する総スタンプ枚数
 * @param {number}      cols        - グリッドの列数（例: 4 → 4×4 = 16マス/シート）
 * @param {number}      perImage    - 1シートに収めるスタンプ数（cols×cols）
 * @returns {string[]} シートプロンプト文字列の配列（シート数 = Math.ceil(total/perImage)）
 */
function buildSheetPrompts(wordList, convType, design, font, personCount, relObj, totalCount, cols, perImage) {
  const personCountNum = parseInt(personCount, 10) || 1;
  // 引数で指定がなければ appState から取得してフォールバック
  const total      = totalCount  || parseInt(appState.totalCount, 10) || 32;
  const gridCols   = cols        || 4;
  const gridPerImg = perImage    || 16;
  const count      = Math.min(wordList.length, total);
  const sheetCount = Math.ceil(count / gridPerImg);

  if (wordList.length < total) {
    console.warn(
      `[LINEスタンプメーカー] wordList が${total}個未満です（現在 ${wordList.length} 個）。` +
      "data.js の該当カテゴリを確認してください。"
    );
  }

  // 登場人数・関係性のセクション文言を組み立てる（buildMasterPrompt と同じロジック）
  let personSection = "";
  if (personCountNum === 1) {
    personSection =
      `登場人数：1名\n` +
      `参照画像の人物1名をキャラクター化し、全マスで同一のキャラクターを描くこと。`;
  } else {
    const relationLabel = relObj ? relObj.label : "不問";
    const relationDesc  = relObj ? relObj.masterDesc : "自然な関係として描く。状況に合った自然な絡みややりとりを表現する";

    personSection =
      `登場人数：最大${personCountNum}名（関係性：${relationLabel}）\n` +
      `参照画像から${personCountNum}名分のキャラクターを作成する。\n` +
      `各マスのセリフ・シーンに最も自然な人数だけを登場させること。\n` +
      `1人が自然な場面は1人だけ、掛け合いが自然な場面は2名以上を登場させてよい。\n` +
      `2名以上が登場するマスでは、${relationDesc}。\n` +
      `どのキャラクターを描く場合も、外見（顔・髪・服・体型・配色）は固定したまま描くこと。`;
  }

  // 各マスの仕様行を生成するヘルパー（startIndex は 0始まりのオフセット）
  function buildCellLines(wordSlice, startIndex) {
    return wordSlice.map((item, idx) => {
      const num = String(startIndex + idx + 1).padStart(2, "0");
      let interactionPart = "";
      if (personCountNum >= 2 && relObj) {
        interactionPart = `（2名以上登場する場合は${relObj.interactionHint}）`;
      }
      return `マス${num}：表情/ポーズ＝${item.pose}${interactionPart}、セリフ＝「${item.text}」`;
    });
  }

  // 全シート共通のキャラ固定・スタイル・グリッド仕様ブロック
  function buildCharAndStyleBlock(cellsInSheet) {
    return (
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ キャラクター固定ルール（最優先・絶対厳守）\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `参照画像の人物の以下の要素を完全に固定し、\n` +
      `グリッド内の全${cellsInSheet}マスで一切変えないこと。\n` +
      `キャラクターの一貫性がこのシートの最重要事項です。\n\n` +
      `・顔立ち（目の形・大きさ、鼻・口・輪郭の形）\n` +
      `・髪型（長さ・流れ・スタイル）と髪の色\n` +
      `・体型・プロポーション\n` +
      `・服装・衣装の色とデザイン\n` +
      `・キャラクター全体の雰囲気・個性\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ 変換スタイル\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${convType.promptText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ アートスタイル\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${design.promptText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ 文字・フォント指定\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `スタンプ内のセリフ・文字は以下で表現すること：\n` +
      `「セリフ」を〔${getFont().promptText}〕で表示、色は〔${getTextColor().promptText}〕\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ グリッドレイアウトの仕様（切り分けのために厳守）\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `この画像は生成後に${cellsInSheet}枚の個別スタンプに均等分割して使用するため、\n` +
      `各マスが独立した1枚のスタンプとして完全に成立する構図にすること。\n\n` +
      `・${gridCols}行×${gridCols}列の合計${cellsInSheet}マスで構成すること\n` +
      `・全マスは完全に均等な正方形・同一サイズにし、\n` +
      `　ピクセル単位でグリッドが整列していること（等分割しても各スタンプがズレずに切り出せる）\n` +
      `・各キャラクターおよびセリフ文字は必ずそのマスの内側に完全に収まること\n` +
      `　（マスの境界線を越えてはみ出してはならない・隣のマスに食い込まない）\n` +
      `・マス間には均一な余白（ガター）を設け、境界が視認できるようにすること\n` +
      `・${getBg().promptText}\n` +
      `・グリッド全体は正方形に近い比率で生成すること`
    );
  }

  // 共通の注意事項ブロック（グリッドサイズに合わせて文言を動的に変える）
  const noticeBlock =
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `■ 注意事項\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `画像生成AIによっては${gridPerImg}マス一括だと細部が乱れることがあります。\n` +
    `うまくいかない場合は、${gridCols}枚（1行${gridCols}マスずつ）に分けて生成するか、\n` +
    `マスタープロンプト＋個別プロンプト方式に切り替えてください。`;

  // シートを sheetCount 枚ループで生成し、配列にして返す
  const sheets = [];
  for (let s = 0; s < sheetCount; s++) {
    const startIdx   = s * gridPerImg;
    const slice      = wordList.slice(startIdx, Math.min(startIdx + gridPerImg, count));
    const cellsInSheet = slice.length;
    const startStamp = startIdx + 1;
    const endStamp   = startIdx + cellsInSheet;
    // シート番号は2枚以上のときのみ ①②… 形式で付ける
    const sheetLabel  = sheetCount > 1
      ? `${"①②③④⑤⑥⑦⑧"[s] || (s + 1)}` : "";
    const sheetTitle  = sheetCount > 1
      ? `【シートプロンプト${sheetLabel}：スタンプ${startStamp}〜${endStamp}番を1枚の画像（${gridCols}×${gridCols}グリッド）にまとめて生成】`
      : `【シートプロンプト：スタンプ${startStamp}〜${endStamp}番を1枚の画像（${gridCols}×${gridCols}グリッド）にまとめて生成】`;

    const cellLines = buildCellLines(slice, startIdx);

    const sheet =
      `${sheetTitle}\n\n` +
      `添付した参照画像を参照して、以下の指示に従いLINEスタンプ用の画像を1枚生成してください。\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ 登場人数・関係性の設定\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${personSection}\n\n` +
      `${buildCharAndStyleBlock(cellsInSheet)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `■ 各マスの仕様（${cellsInSheet}マス分）\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `左上から右方向へ、1行${gridCols}マスずつ順番に配置してください。\n\n` +
      `${cellLines.join("\n")}\n\n` +
      `${noticeBlock}`;

    sheets.push(sheet);
  }

  return sheets;
}

/* =====================================================
 * 結果の表示処理
 * ===================================================== */
/**
 * @param {string}          masterPrompt      - マスタープロンプト文字列
 * @param {string[]}        individualPrompts - 個別プロンプトの配列（シートモード時は []）
 * @param {string[]|null}   sheetPrompts
 *   null         → 兄弟プリセットON（シートなし・参照ヒント表示）
 *   []           → 個別モード（シートブロック非表示・ヒントも非表示）
 *   string[]     → シートモード（全シートを sheet1 ブロックに連結表示）
 */
function renderResults(masterPrompt, individualPrompts, sheetPrompts) {
  const section = document.getElementById("resultsSection");
  section.style.display = "block";

  // sheetPrompts の種別を判定する
  // []       = 個別モード（シートなし・ヒントなし）
  // string[] = シートモード（全シートを sheet1 ブロックに連結表示）
  // 兄弟プリセットON の判定は appState.brotherPresetOn を直接参照する
  const isPreset     = appState.brotherPresetOn;
  const isSheetMode  = Array.isArray(sheetPrompts) && sheetPrompts.length > 0;
  const isIndividual = Array.isArray(sheetPrompts) && sheetPrompts.length === 0;

  // マスタープロンプトを表示する
  document.getElementById("masterPromptText").textContent = masterPrompt;

  // シートブロックの表示制御
  // ・プリセットON / 個別モード → 全シートブロックを非表示
  // ・シートモード → sheet1 ブロックを表示、sheet2 ブロックは非表示（連結表示のため）
  const sheetBlocks = document.querySelectorAll(".sheet-prompt-block");
  sheetBlocks.forEach((el, idx) => {
    if (isPreset || isIndividual) {
      el.style.display = "none";
    } else {
      // sheet1（index=0）のみ表示し、sheet2（index=1）以降は非表示にして sheet1 に連結
      el.style.display = idx === 0 ? "" : "none";
    }
  });

  // 兄弟プリセットON のとき だけ参照ヒントを表示する
  const refHint = document.getElementById("brotherRefHint");
  if (refHint) refHint.style.display = isPreset ? "block" : "none";

  // シートモードのとき、全シートを区切り線で連結して sheet1PromptText に表示する
  if (isSheetMode) {
    const divider = "\n\n" + "═".repeat(50) + "\n\n";
    document.getElementById("sheet1PromptText").textContent = sheetPrompts.join(divider);
  }

  // 一括コピー用テキストをモードに応じて生成する
  // ─ シートモード: マスター + 全シートプロンプト
  // ─ 個別モード:  マスター + 個別プロンプト（枚数はハードコードせず動的取得）
  let allText;
  if (isSheetMode) {
    const divider = "\n\n" + "═".repeat(50) + "\n\n";
    allText =
      "【マスタープロンプト】\n" + masterPrompt + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "【シートプロンプト】\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      sheetPrompts.join(divider);
  } else {
    allText =
      "【マスタープロンプト】\n" + masterPrompt + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      `【個別プロンプト ${individualPrompts.length}枚】\n` +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      individualPrompts.join("\n\n");
  }

  // 一括コピーボタンのデータ属性に格納する
  const bulkCopyBtn = document.getElementById("bulkCopyBtn");
  if (bulkCopyBtn) {
    bulkCopyBtn.dataset.copyText = allText;
  }

  // 個別プロンプトリストを生成する
  const listContainer = document.getElementById("individualPromptsList");
  listContainer.innerHTML = "";

  individualPrompts.forEach((prompt, index) => {
    const item = document.createElement("div");
    item.className = "prompt-item";

    const header = document.createElement("div");
    header.className = "prompt-item-header";

    const numBadge = document.createElement("span");
    numBadge.className = "prompt-num";
    numBadge.textContent = `${index + 1}`;

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-copy-small";
    copyBtn.textContent = "コピー";
    copyBtn.addEventListener("click", () => copyToClipboard(prompt, copyBtn));

    header.appendChild(numBadge);
    header.appendChild(copyBtn);

    const pre = document.createElement("pre");
    pre.className = "prompt-text";
    pre.textContent = prompt;

    item.appendChild(header);
    item.appendChild(pre);
    listContainer.appendChild(item);
  });

  // カウント表示を更新する
  const countEl = document.getElementById("promptCount");
  if (countEl) countEl.textContent = `${individualPrompts.length}個`;
}

/* =====================================================
 * コピー機能
 * ===================================================== */

/**
 * テキストをクリップボードにコピーし、ボタンにフィードバックを表示する
 * @param {string}      text  - コピーするテキスト
 * @param {HTMLElement} btnEl - フィードバックを表示するボタン要素
 */
async function copyToClipboard(text, btnEl) {
  let success = false;

  try {
    await navigator.clipboard.writeText(text);
    success = true;
  } catch (err) {
    // Clipboard API が使えない場合のフォールバック（古いブラウザ対応）
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      success = true;
    } catch (e) {
      showAlert("コピーに失敗しました。手動でテキストを選択してコピーしてください。");
    }
    document.body.removeChild(textarea);
  }

  // 実際にコピーできた場合のみ成功フィードバックを表示する
  if (success) {
    const originalText = btnEl.textContent;
    btnEl.textContent = "コピーしました！";
    btnEl.classList.add("copied");
    setTimeout(() => {
      btnEl.textContent = originalText;
      btnEl.classList.remove("copied");
    }, 2000);
  }
}

// マスタープロンプトのコピーボタン
function copyMasterPrompt() {
  const text = document.getElementById("masterPromptText").textContent;
  const btn  = document.getElementById("masterCopyBtn");
  copyToClipboard(text, btn);
}

// シートプロンプト①のコピーボタン（スタンプ1〜16番）
function copySheet1Prompt() {
  const text = document.getElementById("sheet1PromptText").textContent;
  const btn  = document.getElementById("sheet1CopyBtn");
  copyToClipboard(text, btn);
}

// 全プロンプト一括コピーボタン
function copyAllPrompts() {
  const btn  = document.getElementById("bulkCopyBtn");
  const text = btn.dataset.copyText;
  if (text) copyToClipboard(text, btn);
}

/* =====================================================
 * ユーティリティ
 * ===================================================== */

/**
 * アラートメッセージを画面上部にトースト表示する
 * @param {string} message - 表示するメッセージ
 */
function showAlert(message) {
  const toast = document.createElement("div");
  toast.className = "toast-alert";
  toast.textContent = message;
  document.body.appendChild(toast);

  // 少し待ってからフェードイン
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });

  // 3秒後に自動で消える
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => document.body.removeChild(toast), 400);
  }, 3000);
}

/* =====================================================
 * 兄弟スタンプ（固定スタイル）プリセット機能
 * ===================================================== */

/**
 * 兄弟スタンププリセットの初期設定（DOMContentLoaded から呼ばれる）
 * ─ チェックボックスON/OFFで汎用選択セクション（STEP 2〜7）を表示/非表示する
 * ─ 背景・フォント・文字色はSTEP 8〜10 の各カードで選択する（brotherBg廃止済み）
 */
function setupBrotherPreset() {
  const checkbox = document.getElementById("brotherPresetCheck");
  if (!checkbox) return;

  // プリセットON/OFFトグル
  checkbox.addEventListener("change", () => {
    appState.brotherPresetOn = checkbox.checked;

    // プリセット詳細エリア（背景色選択・案内文）の表示/非表示
    const details = document.getElementById("brotherPresetDetails");
    if (details) details.style.display = checkbox.checked ? "block" : "none";

    // 汎用選択セクション（STEP 2〜6）の表示/非表示
    // ─ プリセットON時は非表示にして固定スタイルで上書きする
    // ─ 総数(stepTotalCount)/まとめ方(stepGridLayout)/背景(stepBackground)/
    //   フォント(step5)/文字色(stepTextColor) はプリセットON時も操作可能にするため含めない
    const genericSectionIds = [
      "stepPersonCount",  // STEP 2: 登場人数
      "stepRelationship", // STEP 3: 関係性
      "step2",            // STEP 4: 変換タイプ
      "step3",            // STEP 5: 用途
      "step4",            // STEP 6: デザイン系統
    ];
    genericSectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = checkbox.checked ? "none" : "";
    });

    // プリセットOFFに戻したとき、関係性セクションは
    // 登場人数の選択状態に応じて表示する（handlePersonCountChange と同じロジック）
    if (!checkbox.checked) {
      const personCountNum = parseInt(appState.personCount, 10) || 0;
      const relSection     = document.getElementById("stepRelationship");
      if (relSection) {
        relSection.style.display = personCountNum >= 2 ? "block" : "none";
      }
    }

    updateGenerateButtonState();
  });

}

/**
 * 兄弟スタンプ（固定スタイル）のマスタープロンプトを生成する
 * ─ BROTHER_STAMP_PRESET.masterBase の 3 つのプレースホルダーを全て置換して返す
 *   {{BG_TEXT}}         → getBg().promptText（appState.background から取得）
 *   {{FONT_TEXT}}       → getFont().promptText（appState.font から取得）
 *   {{TEXT_COLOR_TEXT}} → getTextColor().promptText（appState.textColor から取得）
 * ※ 旧来の bgColor 引数は後方互換のため残すが、内部では appState を使用する
 * @returns {string} プレースホルダーが全て解決されたマスタープロンプト
 */
function buildBrotherMasterPrompt() {
  return BROTHER_STAMP_PRESET.masterBase
    .replace("{{BG_TEXT}}",         getBg().promptText)
    .replace("{{FONT_TEXT}}",       getFont().promptText)
    .replace("{{TEXT_COLOR_TEXT}}", getTextColor().promptText);
}

/**
 * 兄弟スタンプ（固定スタイル）の個別プロンプトを生成する
 * ─ STAMP_DATA.parenting（育児系）の先頭 totalCount 件を使用する
 * ─ 背景・フォント・文字色は appState から getBg/getFont/getTextColor() で取得する
 * ─ 「セリフ・シーンに自然な人数（1〜3人）で描く」を毎プロンプトに含める
 * @param {number} [totalCount] - 生成枚数（省略時は appState.totalCount を参照）
 * @returns {string[]} プロンプト文字列の配列
 */
function buildBrotherIndividualPrompts(totalCount) {
  const count    = totalCount || parseInt(appState.totalCount, 10) || 32;
  const wordList = STAMP_DATA.parenting;
  const total    = Math.min(wordList.length, count);
  const prompts  = [];

  for (let i = 0; i < total; i++) {
    const item = wordList[i];
    const num  = String(i + 1).padStart(2, "0");

    const prompt =
      `【スタンプ${num}】\n` +
      `上のマスター設定のキャラ・絵柄で、以下の1枚を生成してください。\n` +
      `・表情とポーズ：${item.pose}\n` +
      `・セリフ：「${item.text}」を〔${getFont().promptText}〕で表示、色は〔${getTextColor().promptText}〕\n` +
      `・登場人数：このセリフ・シーンに最も自然な人数（1〜3人）で描くこと（お母さんだけ／兄弟だけ／3人、いずれも可）\n` +
      `・背景：${getBg().promptText}`;

    prompts.push(prompt);
  }

  return prompts;
}

/**
 * 兄弟スタンプ（固定スタイル）のシートプロンプト配列を生成する
 * ─ 一般モードの buildSheetPrompts と同じ総数×グリッド分岐ロジックに対応
 * @param {number} totalCount - 生成する総スタンプ枚数
 * @param {number} cols       - グリッドの列数（例: 4 → 4×4 = 16マス/シート）
 * @param {number} perImage   - 1シートに収めるスタンプ数
 * @returns {string[]} シートプロンプト文字列の配列
 */
function buildBrotherSheetPrompts(totalCount, cols, perImage) {
  const count      = Math.min(STAMP_DATA.parenting.length, totalCount);
  const sheetCount = Math.ceil(count / perImage);
  const wordList   = STAMP_DATA.parenting;
  const sheets     = [];

  for (let s = 0; s < sheetCount; s++) {
    const startIdx     = s * perImage;
    const slice        = wordList.slice(startIdx, Math.min(startIdx + perImage, count));
    const cellsInSheet = slice.length;
    const startStamp   = startIdx + 1;
    const endStamp     = startIdx + cellsInSheet;
    const sheetLabel   = sheetCount > 1
      ? `${"①②③④⑤⑥⑦⑧"[s] || (s + 1)}` : "";
    const sheetTitle   = sheetCount > 1
      ? `【シートプロンプト${sheetLabel}：スタンプ${startStamp}〜${endStamp}番（${cols}×${cols}グリッド）】`
      : `【シートプロンプト：スタンプ${startStamp}〜${endStamp}番（${cols}×${cols}グリッド）】`;

    const cellLines = slice.map((item, idx) => {
      const num = String(startIdx + idx + 1).padStart(2, "0");
      return `マス${num}：表情/ポーズ＝${item.pose}、セリフ＝「${item.text}」`;
    });

    const sheet =
      `${sheetTitle}\n\n` +
      `上のマスター設定のキャラ・絵柄で、以下の${cellsInSheet}個のスタンプを${cols}×${cols}グリッドにまとめた1枚の画像を生成してください。\n\n` +
      `■ 各マスの仕様\n` +
      `${cellLines.join("\n")}\n\n` +
      `■ グリッド仕様\n` +
      `・${cols}行×${cols}列の合計${cellsInSheet}マスで構成すること\n` +
      `・全マスは完全に均等な正方形・同一サイズで整列し、ピクセル単位でグリッドが揃うこと\n` +
      `・各キャラクターとセリフはそのマスの内側に収まること（境界をまたがない）\n` +
      `・登場人数：各マスのセリフ・シーンに最も自然な人数（1〜3人）で描くこと\n\n` +
      `■ 背景・文字\n` +
      `・${getBg().promptText}\n` +
      `・「セリフ」を〔${getFont().promptText}〕で表示、色は〔${getTextColor().promptText}〕`;

    sheets.push(sheet);
  }

  return sheets;
}
