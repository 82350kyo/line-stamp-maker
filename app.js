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
  images: [],           // アップロードされた画像（File オブジェクト）
  consent: false,       // 権利同意チェックボックスの状態
  conversionType: null, // 変換タイプ（"character" など）
  usage: null,          // 用途カテゴリ（"greeting" など）
  designStyle: null,    // デザイン系統（"illustration" など）
  fontStyle: null,      // フォント感（"marugo" など）
};

/* =====================================================
 * 初期化処理（ページ読み込み完了後に実行）
 * ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 各セクションのUI部品を生成・配置する
  buildConversionTypeSection();
  buildUsageSection();
  buildDesignStyleSection();
  buildFontStyleSection();

  // 画像アップロードの設定
  setupImageUpload();

  // 同意チェックボックスの設定
  setupConsentCheckbox();

  // 生成ボタンの設定
  setupGenerateButton();

  // 初期状態でボタンの有効/無効を確認
  updateGenerateButtonState();

  // m-4修正: マスタープロンプト・一括コピーボタンのイベントを DOMContentLoaded 内で登録
  // （HTML の onclick 属性ではなく、他のボタンと統一した書き方にする）
  document.getElementById("masterCopyBtn").addEventListener("click", copyMasterPrompt);
  document.getElementById("bulkCopyBtn").addEventListener("click", copyAllPrompts);
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

  // M-2修正: Enter / Space キーでもファイル選択ダイアログを開けるようにする
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // スペースのページスクロールを防ぐ
      fileInput.click();
    }
  });

  // m-2対応: 入室カウンタ方式で dragleave のちらつきを防ぐ
  // 子要素へのホバー移動でも drag-over が外れないようにする
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
    dragEnterCounter = 0; // カウンタをリセットしてフラッシュを防ぐ
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
  const previewArea = document.getElementById("imagePreview");
  const imageCountMsg = document.getElementById("imageCountMsg");

  // 画像ファイルのみを対象にする
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
      // 状態に追加
      const imgData = { file, dataUrl: e.target.result };
      appState.images.push(imgData);

      // サムネイルを表示
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
 * @param {string} containerId - 挿入先のコンテナ要素のID
 * @param {string} groupName   - ラジオボタンのname属性
 * @param {Array}  options     - 選択肢の配列
 * @param {string} stateKey    - appState に保存するキー名
 */
function buildCardGroup(containerId, groupName, options, stateKey) {
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

    // フォント感のサンプル表示
    if (opt.sampleStyle) {
      const sample = document.createElement("div");
      sample.className = "font-sample";
      sample.textContent = "あいうえお ABC";
      sample.setAttribute("style", opt.sampleStyle);
      content.appendChild(icon);
      content.appendChild(titleEl);
      content.appendChild(sample);
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
    });

    container.appendChild(label);
  });
}

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

// フォント感の選択肢を生成
function buildFontStyleSection() {
  buildCardGroup("fontStyleCards", "fontStyle", FONT_STYLES, "fontStyle");
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
 */
function updateGenerateButtonState() {
  const btn = document.getElementById("generateBtn");
  if (!btn) return;

  const isReady =
    appState.images.length >= 1 &&
    appState.consent &&
    appState.conversionType &&
    appState.usage &&
    appState.designStyle &&
    appState.fontStyle;

  btn.disabled = !isReady;

  // 未完了の項目をヒント表示
  const hintEl = document.getElementById("generateHint");
  if (hintEl) {
    if (isReady) {
      hintEl.textContent = "すべての設定が完了しました！生成ボタンを押してください。";
      hintEl.className = "generate-hint ready";
    } else {
      const missing = [];
      if (appState.images.length === 0) missing.push("参照画像のアップロード");
      if (!appState.consent) missing.push("権利確認チェックボックス");
      if (!appState.conversionType) missing.push("変換タイプ");
      if (!appState.usage) missing.push("用途");
      if (!appState.designStyle) missing.push("デザイン系統");
      if (!appState.fontStyle) missing.push("フォント感");
      hintEl.textContent = "未完了：" + missing.join("、");
      hintEl.className = "generate-hint pending";
    }
  }
}

/* =====================================================
 * プロンプト生成処理（アプリの核心機能）
 * ===================================================== */
function handleGenerate() {
  // 選んだ設定のオブジェクトを取得
  const convType = CONVERSION_TYPES.find((c) => c.value === appState.conversionType);
  const usageCat = USAGE_CATEGORIES.find((u) => u.value === appState.usage);
  const design   = DESIGN_STYLES.find((d) => d.value === appState.designStyle);
  const font     = FONT_STYLES.find((f) => f.value === appState.fontStyle);

  // 用途に対応するスタンプ文言リストを取得
  const wordList = STAMP_DATA[usageCat.dataKey];

  // m-5修正: wordList が取得できない場合はエラーを表示して処理を中断する
  if (!wordList) {
    showAlert(
      `データの取得に失敗しました（キー: ${usageCat.dataKey}）。` +
      "ページを再読み込みして、もう一度お試しください。"
    );
    return;
  }

  // --- (A) マスタープロンプトを生成 ---
  const masterPrompt = buildMasterPrompt(convType, design, font, appState.images.length);

  // --- (B) 49個の個別プロンプトを生成 ---
  const individualPrompts = buildIndividualPrompts(wordList, convType, design, font);

  // 結果を画面に表示
  renderResults(masterPrompt, individualPrompts);

  // 結果エリアまでスムーズスクロール
  document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
}

/**
 * マスタープロンプト（キャラ固定用の最初の1個）を生成する
 */
function buildMasterPrompt(convType, design, font, imageCount) {
  const imageText =
    imageCount === 1
      ? "添付した参照画像（1枚）"
      : `添付した参照画像（${imageCount}枚、同一人物の異なるアングル）`;

  return `【マスタープロンプト：キャラクター設定の固定】

${imageText}を参照して、LINEスタンプ用のキャラクターを以下の指示に従って生成してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ キャラクター固定ルール（最優先・絶対厳守）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
参照画像に映っている人物の以下の要素を完全に固定し、
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
・背景は完全透明（透過PNG）にすること
・キャラクターを画面中央に大きく配置し、
　上下左右に約 10% の余白を設けること
・1枚につき1キャラクターのみ描くこと
・文字はキャラクターの下部または周辺に
　自然になじむように配置すること

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 文字・フォント指定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
スタンプ内のセリフ・文字は以下で表現すること：
「${font.promptText}」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ シリーズ制作の宣言
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
これからこのキャラクターで合計 49 枚のスタンプを
順番に生成します。

表情・ポーズ・セリフは各スタンプで変わりますが、
キャラクターの外見（顔・髪・服・体型・配色）は
絶対に変えないでください。

各プロンプトを受け取ったら、必ずこのマスター設定を
参照してからキャラクターを描いてください。
キャラクターの一貫性がこのシリーズの最重要事項です。`;
}

/**
 * 49個の個別プロンプトを生成する
 * @param {Array} wordList - スタンプ文言と表情ヒントの配列
 * @param {Object} convType - 変換タイプオブジェクト
 * @param {Object} design   - デザイン系統オブジェクト
 * @param {Object} font     - フォント感オブジェクト
 * @returns {string[]} 49個のプロンプト文字列の配列
 */
function buildIndividualPrompts(wordList, convType, design, font) {
  // m-1修正: wordList が49個未満の場合は開発者向け警告を出す（サイレント減数の防止）
  if (wordList.length < 49) {
    console.warn(
      `[LINEスタンプメーカー] wordList が49個未満です（現在 ${wordList.length} 個）。` +
      "data.js の該当カテゴリを確認してください。"
    );
  }

  // 49枚分のプロンプトを生成（文言リストが49個あるのでそのまま使う）
  const prompts = [];
  const total = Math.min(wordList.length, 49);

  for (let i = 0; i < total; i++) {
    const item = wordList[i];
    const num  = String(i + 1).padStart(2, "0");

    // 簡潔なスタイルタグ（毎回フルで書くと冗長なので語尾に短く付ける）
    const styleTag = `（${design.label}・${font.label}・透過背景・正方形）`;

    const prompt =
      `【スタンプ${num}】\n` +
      `上のマスタープロンプトのキャラクター設定に従い、以下の1枚を生成してください。\n` +
      `・表情とポーズ：${item.pose}\n` +
      `・セリフ：「${item.text}」を${font.label}で表示\n` +
      `・スタイル${styleTag}`;

    prompts.push(prompt);
  }

  return prompts;
}

/* =====================================================
 * 結果の表示処理
 * ===================================================== */
function renderResults(masterPrompt, individualPrompts) {
  const section = document.getElementById("resultsSection");
  section.style.display = "block";

  // マスタープロンプトを表示
  document.getElementById("masterPromptText").textContent = masterPrompt;

  // 49枚一括コピー用のテキストを準備
  const allText =
    "【マスタープロンプト】\n" + masterPrompt + "\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "【個別プロンプト 49枚】\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
    individualPrompts.join("\n\n");

  // 一括コピーボタンのデータ属性に格納
  const bulkCopyBtn = document.getElementById("bulkCopyBtn");
  if (bulkCopyBtn) {
    bulkCopyBtn.dataset.copyText = allText;
  }

  // 個別プロンプトリストを生成
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

  // カウント表示
  const countEl = document.getElementById("promptCount");
  if (countEl) countEl.textContent = `${individualPrompts.length}個`;
}

/* =====================================================
 * コピー機能
 * ===================================================== */

/**
 * テキストをクリップボードにコピーし、ボタンにフィードバックを表示する
 * @param {string} text          - コピーするテキスト
 * @param {HTMLElement} btnEl    - フィードバックを表示するボタン要素
 */
async function copyToClipboard(text, btnEl) {
  // M-1修正: 成功フラグを導入し、実際にコピーできた場合のみフィードバックを表示する
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
      success = true; // execCommand でのコピーも成功扱い
    } catch (e) {
      showAlert("コピーに失敗しました。手動でテキストを選択してコピーしてください。");
    }
    document.body.removeChild(textarea);
  }

  // 実際にコピーできた場合のみ成功フィードバックを表示（失敗時は showAlert のみ）
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

// マスタープロンプトのコピーボタン（m-4修正後は DOMContentLoaded 内のリスナーから呼ばれる）
function copyMasterPrompt() {
  const text = document.getElementById("masterPromptText").textContent;
  const btn  = document.getElementById("masterCopyBtn");
  copyToClipboard(text, btn);
}

// 全プロンプト一括コピーボタン（m-4修正後は DOMContentLoaded 内のリスナーから呼ばれる）
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
