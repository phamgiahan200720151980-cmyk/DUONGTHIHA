const generateBtn = document.getElementById("generate");
const questionDiv = document.getElementById("question");
const resultDiv = document.getElementById("result");
const subjectSelect = document.getElementById("subject");
const typeSelect = document.getElementById("type");
const tracnghiemBox = document.getElementById("tracnghiemBox");
const tuluanBox = document.getElementById("tuluanBox");
const answerInput = document.getElementById("answer");
const previewDiv = document.getElementById("preview");

let previewTimeout;
answerInput.addEventListener('input', () => {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    updatePreview();
  }, 500);
});

function insertSymbol(symbol) {
  const textarea = document.getElementById("answer");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  textarea.value = text.substring(0, start) + symbol + text.substring(end);
  
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + symbol.length;
}

function insertTemplate(template, cursorOffset) {
  const textarea = document.getElementById("answer");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const wrappedTemplate = '$' + template + '$';
  textarea.value = text.substring(0, start) + wrappedTemplate + text.substring(end);
  
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + cursorOffset + 1;
  updatePreview();
}

function updatePreview() {
  const text = answerInput.value;
  
  if (!text.trim()) {
    previewDiv.innerHTML = 'Gõ công thức có dấu $ để xem preview...';
    return;
  }
  
  previewDiv.innerHTML = text || 'Gõ công thức có dấu $ để xem preview...';
  
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetClear([previewDiv]);
    MathJax.typesetPromise([previewDiv]).catch((err) => {
      console.log('MathJax preview error:', err);
    });
  }
}

typeSelect.addEventListener("change", () => {
  if (typeSelect.value === "tracnghiem") {
    tracnghiemBox.style.display = "block";
    tuluanBox.style.display = "none";
  } else {
    tracnghiemBox.style.display = "none";
    tuluanBox.style.display = "block";
  }
});

generateBtn.addEventListener("click", async () => {
  const subject = subjectSelect.value;
  const type = typeSelect.value;
  const includeAnswer = document.getElementById("includeAnswer").checked;

  let prompt = "";

  if (type === "tracnghiem") {
    prompt = includeAnswer
      ? `Hãy tạo 1 câu hỏi trắc nghiệm ôn thi THPT môn ${subject === "toan" ? "Toán" : "Vật Lý"} lớp 12.
         Bao gồm 4 lựa chọn (A, B, C, D) và ghi rõ đáp án đúng.
         
         QUAN TRỌNG: Với MỌI công thức toán học và ký hiệu đặc biệt, BẮT BUỘC phải dùng LaTeX trong dấu $.
         Ví dụ: $\\omega_0 = \\sqrt{\\omega_1 \\cdot \\omega_2}$, $\\frac{a}{b}$, $x^2$, $\\alpha$, $\\pi$, $\\int_0^1$, v.v.
         KHÔNG ĐƯỢC viết omega_0, omega_1 hay các ký tự đặc biệt mà không có dấu $`
      : `Hãy tạo 1 câu hỏi trắc nghiệm ôn thi THPT môn ${subject === "toan" ? "Toán" : "Vật Lý"} lớp 12.
         Bao gồm 4 lựa chọn (A, B, C, D) nhưng KHÔNG nêu đáp án.
         
         QUAN TRỌNG: Với MỌI công thức toán học và ký hiệu đặc biệt, BẮT BUỘC phải dùng LaTeX trong dấu $.
         Ví dụ: $\\omega_0 = \\sqrt{\\omega_1 \\cdot \\omega_2}$, $\\frac{a}{b}$, $x^2$, $\\alpha$, $\\pi$, $\\int_0^1$, v.v.
         KHÔNG ĐƯỢC viết omega_0, omega_1 hay các ký tự đặc biệt mà không có dấu $`;
  } else {
    prompt = includeAnswer
      ? `Hãy tạo 1 bài tập tự luận ôn thi THPT môn ${subject === "toan" ? "Toán" : "Vật Lý"} lớp 12, có đáp án chi tiết.
         
         QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.
         Ví dụ: $x^2 + y^2 = r^2$, $\\frac{dy}{dx}$, $\\int$, $\\sum$`
      : `Hãy tạo 1 bài tập tự luận ôn thi THPT môn ${subject === "toan" ? "Toán" : "Vật Lý"} lớp 12, chỉ có đề bài.
         
         QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.
         Ví dụ: $x^2 + y^2 = r^2$, $\\frac{dy}{dx}$, $\\int$, $\\sum$`;
  }

  questionDiv.innerHTML = `<b>Đang tạo bài tập...</b>`;
  const question = await callAI(prompt);
  questionDiv.innerHTML = `<b>Đề bài:</b><br>${question}`;

  if (window.MathJax) {
    MathJax.typesetClear([questionDiv]);
    MathJax.typesetPromise([questionDiv]).catch((err) => console.log('MathJax error:', err));
  }
});

async function submitAnswer() {
  const userAnswer = answerInput.value.trim();
  if (!userAnswer) {
    resultDiv.innerHTML = `<b style="color:red;">Vui lòng nhập câu trả lời!</b>`;
    return;
  }

  const subject = subjectSelect.value;
  const question = questionDiv.innerText;
  const prompt = `
  Bạn là giáo viên ${subject === "toan" ? "Toán" : "Vật Lý"} THPT.
  Hãy CHẤM ĐIỂM (0–10) và NHẬN XÉT NGẮN GỌN cho bài làm sau:
  ❖ Đề bài: ${question}
  ❖ Bài làm: ${userAnswer}
  
  QUAN TRỌNG: Với MỌI công thức toán học, BẮT BUỘC phải dùng LaTeX trong dấu $.
  Ví dụ: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\omega$, $\\alpha$
  `;
  resultDiv.innerHTML = `<b>Đang chấm điểm...</b>`;
  const result = await callAI(prompt);
  resultDiv.innerHTML = `<b>Kết quả:</b><br>${result}`;
  
  if (window.MathJax) {
    MathJax.typesetClear([resultDiv]);
    MathJax.typesetPromise([resultDiv]).catch((err) => console.log('MathJax error:', err));
  }
}

async function submitChoice() {
  const selected = document.querySelector('input[name="choice"]:checked');
  if (!selected) {
    resultDiv.innerHTML = `<b style="color:red;">Hãy chọn 1 đáp án!</b>`;
    return;
  }

  const subject = subjectSelect.value;
  const question = questionDiv.innerText;
  const answer = selected.value;

  const prompt = `
  Bạn là giáo viên ${subject === "toan" ? "Toán" : "Vật Lý"} THPT.
  Hãy chấm xem đáp án học sinh chọn (${answer}) là ĐÚNG hay SAI,
  đồng thời giải thích chi tiết vì sao.
  ❖ Câu hỏi: ${question}
  ❖ Học sinh chọn: ${answer}
  
  QUAN TRỌNG: Với MỌI công thức toán học và ký hiệu đặc biệt, BẮT BUỘC phải dùng LaTeX trong dấu $.
  Ví dụ: $\\omega_0 = \\sqrt{\\omega_1 \\cdot \\omega_2}$, $\\frac{a}{b}$, $x^2$, $\\alpha$, $\\pi$, $\\int_0^1$, v.v.
  KHÔNG ĐƯỢC viết omega_0, omega_1, \\omega_0, \\sqrt{} hay các ký tự đặc biệt mà không có dấu $
  `;
  resultDiv.innerHTML = `<b>Đang chấm điểm...</b>`;
  const result = await callAI(prompt);
  resultDiv.innerHTML = `<b>Kết quả:</b><br>${result}`;
  
  if (window.MathJax) {
    MathJax.typesetClear([resultDiv]);
    MathJax.typesetPromise([resultDiv]).catch((err) => console.log('MathJax error:', err));
  }
}

async function callAI(prompt) {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    
    if (data.error) {
      console.error("API Error:", data.error);
      return "❌ Lỗi: " + data.error;
    }
    
    return data.text;
  } catch (err) {
    console.error(err);
    return "❌ Lỗi: Không kết nối được với AI.";
  }
}

let selectedImage = null;
let selectedFile = null;

function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  selectedImage = file;
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `
      <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
      <p style="margin-top: 10px; color: #666;">✓ Đã chọn: ${file.name}</p>
    `;
    document.getElementById('submitImageBtn').style.display = 'inline-block';
  };
  
  reader.readAsDataURL(file);
}

function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  selectedFile = file;
  const preview = document.getElementById('filePreview');
  const fileSize = (file.size / 1024).toFixed(2);
  
  preview.innerHTML = `
    <div style="padding: 15px; background: #f0f8ff; border-radius: 8px; border: 2px dashed #008cff;">
      <p style="margin: 5px 0; color: #0055aa;"><strong>📄 File đã chọn:</strong></p>
      <p style="margin: 5px 0; color: #333;">Tên: ${file.name}</p>
      <p style="margin: 5px 0; color: #666;">Kích thước: ${fileSize} KB</p>
    </div>
  `;
  document.getElementById('submitFileBtn').style.display = 'inline-block';
}

async function submitImage() {
  if (!selectedImage) {
    alert('Vui lòng chọn hình ảnh trước!');
    return;
  }
  
  const question = questionDiv.innerText;
  if (!question || question.includes('Đang tạo')) {
    alert('Vui lòng tạo đề bài trước khi nộp!');
    return;
  }
  
  const subject = subjectSelect.value;
  const formData = new FormData();
  formData.append('image', selectedImage);
  formData.append('question', question);
  formData.append('subject', subject);
  
  resultDiv.innerHTML = `<b>Đang nhận diện và chấm bài từ hình ảnh...</b>`;
  
  try {
    const res = await fetch('/api/grade-image', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.error) {
      resultDiv.innerHTML = `<b style="color:red;">❌ Lỗi: ${data.error}</b>`;
      return;
    }
    
    resultDiv.innerHTML = `<b>Kết quả chấm bài từ hình ảnh:</b><br>${data.text}`;
    
    if (window.MathJax) {
      MathJax.typesetClear([resultDiv]);
      MathJax.typesetPromise([resultDiv]).catch((err) => console.log('MathJax error:', err));
    }
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<b style="color:red;">❌ Lỗi: Không thể kết nối với server</b>`;
  }
}

async function submitFile() {
  if (!selectedFile) {
    alert('Vui lòng chọn file trước!');
    return;
  }
  
  const question = questionDiv.innerText;
  if (!question || question.includes('Đang tạo')) {
    alert('Vui lòng tạo đề bài trước khi nộp!');
    return;
  }
  
  const subject = subjectSelect.value;
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('question', question);
  formData.append('subject', subject);
  
  resultDiv.innerHTML = `<b>Đang xử lý và chấm bài từ file...</b>`;
  
  try {
    const res = await fetch('/api/grade-file', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.error) {
      resultDiv.innerHTML = `<b style="color:red;">❌ Lỗi: ${data.error}</b>`;
      return;
    }
    
    resultDiv.innerHTML = `<b>Kết quả chấm bài từ file:</b><br>${data.text}`;
    
    if (window.MathJax) {
      MathJax.typesetClear([resultDiv]);
      MathJax.typesetPromise([resultDiv]).catch((err) => console.log('MathJax error:', err));
    }
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<b style="color:red;">❌ Lỗi: Không thể kết nối với server</b>`;
  }
}

function toggleChat() {
  const chatBox = document.getElementById('chatBox');
  const chatToggle = document.getElementById('chatToggle');
  
  if (chatBox.style.display === 'flex') {
    chatBox.style.display = 'none';
    chatToggle.style.display = 'flex';
  } else {
    chatBox.style.display = 'flex';
    chatToggle.style.display = 'none';
  }
}

async function sendChatMessage() {
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const message = chatInput.value.trim();
  
  if (!message) {
    alert('Vui lòng nhập câu hỏi!');
    return;
  }
  
  const subject = subjectSelect.value;
  
  const userMessageDiv = document.createElement('div');
  userMessageDiv.className = 'chat-message user-message';
  userMessageDiv.innerHTML = `
    <div class="message-content">
      <strong>Bạn:</strong> ${message}
    </div>
  `;
  chatMessages.appendChild(userMessageDiv);
  
  chatInput.value = '';
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message ai-message';
  loadingDiv.id = 'loading-message';
  loadingDiv.innerHTML = `
    <div class="message-content">
      <strong>Giáo viên AI:</strong> <em>Đang suy nghĩ...</em>
    </div>
  `;
  chatMessages.appendChild(loadingDiv);
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, subject })
    });
    
    const data = await res.json();
    
    loadingDiv.remove();
    
    if (data.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'chat-message ai-message';
      errorDiv.innerHTML = `
        <div class="message-content">
          <strong>Giáo viên AI:</strong> <span style="color:red;">❌ Lỗi: ${data.error}</span>
        </div>
      `;
      chatMessages.appendChild(errorDiv);
    } else {
      const aiMessageDiv = document.createElement('div');
      aiMessageDiv.className = 'chat-message ai-message';
      aiMessageDiv.innerHTML = `
        <div class="message-content">
          <strong>Giáo viên AI:</strong> ${data.text}
        </div>
      `;
      chatMessages.appendChild(aiMessageDiv);
      
      if (window.MathJax) {
        MathJax.typesetClear([aiMessageDiv]);
        MathJax.typesetPromise([aiMessageDiv]).catch((err) => console.log('MathJax error:', err));
      }
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error(err);
    loadingDiv.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-message ai-message';
    errorDiv.innerHTML = `
      <div class="message-content">
        <strong>Giáo viên AI:</strong> <span style="color:red;">❌ Không thể kết nối với server</span>
      </div>
    `;
    chatMessages.appendChild(errorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

document.getElementById('chatInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});
