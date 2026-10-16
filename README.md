# DingTag Annotation tool

**Fast Text Processing for Annotation & QC**

---

## 🇮🇩 Bahasa Indonesia

### Preview
_Preview visual belum ditambahkan._

### Fitur
- Pemrosesan multi-mode (V1, V2.2, Mode Biasa, Filter Custom)
- Logika perbaikan (fixer) bawaan
- Pembersih teks (Flat Text)
- Deteksi kata berulang real-time
- Pengeditan berbasis token
- Mode gelap/terang
- Dukungan pembayaran QRIS

### Penjelasan Mode
- **Mode Biasa** → Fleksibel, bekerja seperti AI standar tanpa perlu prompt manual.
- **V1** → Pemrosesan anotasi dasar menggunakan metode backslash.
- **V2.2** → Fixer canggih dengan validasi otomatis dan deteksi kesalahan.
- **Filter Custom** → Berbasis aturan (rule-based), tanpa AI, untuk kontrol penuh.

### Alur Kerja
Input → Pemilihan Mode → Proses → Output → Submit

### Kasus Penggunaan
- Anotasi Audio
- Quality Control (QC)
- Pengeditan teks massal (Batch editing)

### Memulai
```bash
# Clone
git clone https://github.com/progstay17/Fadhil-Annotation-AIT.git
cd Fadhil-Annotation-AIT

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan nilai Anda

# Jalankan development
npm run dev

# Build
npm run build

# Deploy (Vercel)
npx vercel deploy
```

### Roadmap
- Perbaikan UI
- Optimasi performa
- Ekspansi fitur

### Kontribusi
Panduan kontribusi sederhana: Fork repo, buat perubahan, dan kirim PR.

### Lisensi
Lisensi MIT.

---

## 🇬🇧 English

### Preview
_Visual preview has not been added yet._

### Features
- Multi-mode processing (V1, V2.2, Normal Mode, Custom Filter)
- Built-in fixer logic
- Flat text cleaner
- Real-time duplicate detection
- Token-based editing
- Dark/light mode
- QRIS payment support

### Modes Explanation
- **Normal Mode** → Flexible, works like standard AI without needing manual prompts.
- **V1** → Basic annotation processing using the backslash method.
- **V2.2** → Advanced fixer with automatic validation and error detection.
- **Custom Filter** → Rule-based, no AI, for full control.

### Workflow
Input → Mode Selection → Process → Output → Submit

### Use Cases
- Audio annotation
- Quality Control (QC)
- Batch text editing

### Getting Started
```bash
# Clone
git clone https://github.com/progstay17/Fadhil-Annotation-AIT.git
cd Fadhil-Annotation-AIT

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Run development
npm run dev

# Build
npm run build

# Deploy (Vercel)
npx vercel deploy
```

### Roadmap
- UI improvement
- Performance optimization
- Feature expansion

### Contributing
Simple contribution guide: Fork the repo, make changes, and submit a PR.

### License
MIT License.

---

## 🇨🇳 中文 (Mandarin)

### 预览
_尚未添加界面预览。_

### 特性
- 多模式处理 (V1, V2.2, 普通模式, 自定义过滤器)
- 内置修复逻辑
- 平展文本清洗器
- 实时重复词检测
- 基于标记 (Token) 的编辑
- 深色/浅色模式
- 支持 QRIS 支付

### 模式说明
- **普通模式** → 灵活，像标准 AI 一样工作，无需手动提示词。
- **V1** → 使用反斜杠方法的基础标注处理。
- **V2.2** → 具有自动验证和错误检测功能的高级修复程序。
- **自定义过滤器** → 基于规则，无 AI，实现完全控制。

### 工作流
输入 → 模式选择 → 处理 → 输出 → 提交

### 使用场景
- 音频标注
- 质量控制 (QC)
- 批量文本编辑

### 开始使用
```bash
# 克隆
git clone https://github.com/progstay17/Fadhil-Annotation-AIT.git
cd Fadhil-Annotation-AIT

# 安装依赖
npm install

# 设置环境
cp .env.example .env
# 使用您的值编辑 .env

# 运行开发环境
npm run dev

# 构建
npm run build

# 部署 (Vercel)
npx vercel deploy
```

### 路线图
- UI 改进
- 性能优化
- 功能扩展

### 贡献
简单的贡献指南：Fork 仓库，进行更改，并提交 PR。

### 许可证
MIT 许可证。

---

## API

### POST `/api/transcribe`
Description: Processes text using various AI models and system prompts.

**Request body:**
```json
{
  "text": "string",
  "provider": "google | groq",
  "systemPrompt": "string"
}
```

**Response:**
```json
{
  "result": "processed text result"
}
```
