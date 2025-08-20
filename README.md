# 🐦 Bird Watcher

An AI-powered bird identification app that uses machine learning to identify bird species from uploaded images. Built with Next.js, TypeScript, and modern web technologies.

## ✨ Features

- 📸 **Image Upload**: Drag & drop, camera capture, or file selection
- 🤖 **Dual AI Models**: Choose between self-trained and Hugging Face pretrained models
- 📊 **Confidence Scoring**: Get percentage confidence in predictions
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Dark Mode Support**: Automatic theme switching
- 📋 **Species Database**: View all 400+ bird species the model recognizes
- ⚡ **Real-time Processing**: Fast image analysis and results
- 🛡️ **Rate Limiting**: Built-in upload protection

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- A backend API server (see Configuration section)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/qoreycube/bird-watcher.git
cd bird-watcher
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API endpoints
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Configuration

Create a `.env.local` file in the root directory:

```env
# Backend API base URLs
LOCAL_API_BASE=http://127.0.0.1:9000
REMOTE_API_BASE=http://your-backend-server.com:9000
```

The app automatically detects if you're running locally and uses the appropriate backend URL.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Image Processing**: Sharp (server-side resizing)
- **Deployment**: Vercel-ready
- **Code Quality**: ESLint, TypeScript strict mode

## 📁 Project Structure

```
bird-watcher/
├── app/
│   ├── api/
│   │   ├── birdsubmit/     # Image upload & prediction API
│   │   └── species/        # Species list API
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main application page
├── lib/
│   └── apiBaseUrl.ts       # Backend URL resolution
├── types/
│   ├── bird-prediction.ts      # Prediction type definitions
│   ├── bird-prediction-response.ts
│   └── species-response.ts
└── public/                 # Static assets
```

## 🎯 Usage

1. **Select Model**: Choose between "Self-trained" or "Hugging Face Pretrained Model"
2. **Upload Image**: 
   - Click "Camera / Gallery" to select from device
   - Drag and drop an image onto the upload area
   - Images are automatically resized to 400px width for optimal processing
3. **View Results**: See the predicted species and confidence percentage
4. **Explore Species**: Click to view all species the model can identify

## 🔒 Rate Limiting

The app includes built-in rate limiting:
- Maximum 5 uploads per minute per IP address
- Automatic cleanup of old timestamps
- Graceful error messages for exceeded limits

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Manual Deployment

```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Bird identification models trained on diverse avian datasets
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first styling approach
- Sharp library for efficient image processing

---

**Disclaimer**: This AI-powered bird prediction is for fun and guidance! Results may not be 100% accurate—after all, even the smartest birds get confused sometimes. Use as a helpful companion, not a definitive source. Happy bird watching! 🦅
