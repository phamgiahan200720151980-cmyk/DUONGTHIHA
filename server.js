import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mammoth from 'mammoth';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

const app = express();
const PORT = 5000;

// Khởi tạo Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Cấu hình multer để upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.txt', '.docx'];
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedExts.includes(fileExt) || allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif) hoặc tài liệu (txt, docx). Lưu ý: Chỉ hỗ trợ file Word định dạng .docx, không hỗ trợ .doc cũ.'));
    }
  }
});

// Helper function để retry khi API bị overload
async function callGeminiWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const isOverloaded = error.message && error.message.includes('overloaded');
      const isLastAttempt = i === maxRetries - 1;
      
      if (isOverloaded && !isLastAttempt) {
        console.log(`API overloaded, retrying... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        continue;
      }
      
      if (isOverloaded) {
        throw new Error('Gemini AI đang quá tải. Vui lòng thử lại sau vài giây. 🔄');
      }
      
      throw error;
    }
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// API endpoint để tạo câu hỏi và chấm bài
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Gọi Gemini AI với retry
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    });

    const text = response.text || "Không thể tạo nội dung";
    
    res.json({ text });
  } catch (error) {
    console.error('Error calling Gemini AI:', error);
    res.status(500).json({ 
      error: error.message || 'Có lỗi xảy ra khi gọi AI' 
    });
  }
});

// API endpoint để chấm bài từ hình ảnh
app.post('/api/grade-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload hình ảnh' });
    }

    const { question, subject } = req.body;
    const imagePath = req.file.path;
    
    // Đọc file hình ảnh thành base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Tạo prompt cho AI
    const prompt = `Bạn là giáo viên ${subject === 'toan' ? 'Toán' : 'Vật Lý'} THPT.
Hãy NHẬN DIỆN chữ viết trong hình ảnh bài làm của học sinh, sau đó CHẤM ĐIỂM (0–10) và NHẬN XÉT NGẮN GỌN.

❖ Đề bài: ${question}

Hãy:
1. Nhận diện nội dung bài làm từ hình ảnh
2. Chấm điểm từ 0-10
3. Đưa ra nhận xét chi tiết

QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.
Ví dụ: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\omega$, $\\alpha$`;

    // Gọi Gemini Vision API với retry
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              { text: prompt },
              { 
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image
                }
              }
            ]
          }
        ]
      });
    });

    const text = response.text || "Không thể phân tích hình ảnh";
    
    // Xóa file sau khi xử lý
    fs.unlinkSync(imagePath);
    
    res.json({ text });
  } catch (error) {
    console.error('Error processing image:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      error: error.message || 'Có lỗi xảy ra khi xử lý hình ảnh' 
    });
  }
});

// API endpoint để chấm bài từ file
app.post('/api/grade-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload file' });
    }

    const { question, subject } = req.body;
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    let fileContent = '';
    let prompt = '';

    // Xử lý theo loại file
    if (fileExt === '.txt') {
      fileContent = fs.readFileSync(filePath, 'utf-8');
      prompt = `Bạn là giáo viên ${subject === 'toan' ? 'Toán' : 'Vật Lý'} THPT.
Hãy CHẤM ĐIỂM (0–10) và NHẬN XÉT NGẮN GỌN cho bài làm sau:

❖ Đề bài: ${question}
❖ Bài làm của học sinh:
${fileContent}

QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.`;
    } else if (fileExt === '.docx') {
      // Xử lý file Word (.docx only)
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        fileContent = result.value;
        
        if (!fileContent.trim()) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'Không thể đọc nội dung file Word. File có thể bị lỗi hoặc rỗng.' });
        }
        
        prompt = `Bạn là giáo viên ${subject === 'toan' ? 'Toán' : 'Vật Lý'} THPT.
Hãy CHẤM ĐIỂM (0–10) và NHẬN XÉT NGẮN GỌN cho bài làm sau:

❖ Đề bài: ${question}
❖ Bài làm của học sinh:
${fileContent}

QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.`;
      } catch (docError) {
        console.error('Error reading .docx:', docError);
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Không thể đọc file Word. Vui lòng đảm bảo file là định dạng .docx hợp lệ.' });
      }
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
      // Nếu là hình ảnh, xử lý như API grade-image
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      prompt = `Bạn là giáo viên ${subject === 'toan' ? 'Toán' : 'Vật Lý'} THPT.
Hãy NHẬN DIỆN chữ viết trong hình ảnh, sau đó CHẤM ĐIỂM (0–10) và NHẬN XÉT.

❖ Đề bài: ${question}

QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.`;

      const response = await callGeminiWithRetry(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Image }}
            ]
          }]
        });
      });

      const text = response.text || "Không thể phân tích file";
      fs.unlinkSync(filePath);
      return res.json({ text });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Định dạng file không được hỗ trợ' });
    }

    // Gọi AI để chấm bài với retry
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
    });

    const text = response.text || "Không thể chấm bài";
    
    // Xóa file sau khi xử lý
    fs.unlinkSync(filePath);
    
    res.json({ text });
  } catch (error) {
    console.error('Error processing file:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      error: error.message || 'Có lỗi xảy ra khi xử lý file' 
    });
  }
});

// API endpoint cho chatbox với giáo viên AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, subject } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Tin nhắn không được để trống' });
    }

    const prompt = `Bạn là giáo viên ${subject === 'toan' ? 'Toán' : 'Vật Lý'} THPT thân thiện và nhiệt tình.
Học sinh hỏi: ${message}

Hãy trả lời một cách rõ ràng, dễ hiểu và khuyến khích học sinh.
QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.
Ví dụ: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$`;

    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
    });

    const text = response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
    
    res.json({ text });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      error: error.message || 'Có lỗi xảy ra trong chat' 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server đang chạy tại http://0.0.0.0:${PORT}`);
  console.log(`✅ Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Đã cấu hình' : 'Chưa cấu hình'}`);
});
