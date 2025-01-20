import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

// DOM Elements
const logsContainer = document.getElementById('logs-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const micIcon = document.getElementById('mic-icon');
const audioVisualizer = document.getElementById('audio-visualizer');
const connectButton = document.getElementById('connect-button');
const cameraButton = document.getElementById('camera-button');
const cameraIcon = document.getElementById('camera-icon');
const stopVideoButton = document.getElementById('stop-video');
const screenButton = document.getElementById('screen-button');
const screenIcon = document.getElementById('screen-icon');
const screenContainer = document.getElementById('screen-container');
const screenPreview = document.getElementById('screen-preview');
const inputAudioVisualizer = document.getElementById('input-audio-visualizer');
const voiceSelect = document.getElementById('voice-select');
const sampleRateInput = document.getElementById('sample-rate-input');
const systemInstructionInput = document.getElementById('system-instruction');
const applyConfigButton = document.getElementById('apply-config');
const configToggle = document.getElementById('config-toggle');
const toggleLogs = document.getElementById('toggle-logs');
const logsWrapper = document.querySelector('.logs-wrapper');
const configContainer = document.getElementById('config-container');

// Theme switcher
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
// Set initial theme from localStorage or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
root.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? 'light_mode' : 'dark_mode';
themeToggle.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? 'light_mode' : 'dark_mode';
});

// State variables
let isRecording = false;
let audioStreamer = null;
let audioCtx = null;
let isConnected = false;
let audioRecorder = null;
let isVideoActive = false;
let videoManager = null;
let isScreenSharing = false;
let screenRecorder = null;
let isUsingTool = false;

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDTsjYZNWFfZOESP-2QQfbD7jc5fG9FJdc",
  authDomain: "explore-malaysia-6d28d.firebaseapp.com",
  databaseURL: "https://explore-malaysia-6d28d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "explore-malaysia-6d28d",
  storageBucket: "explore-malaysia-6d28d.appspot.com",
  messagingSenderId: "869053244601",
  appId: "1:869053244601:web:79ddd74f5bd792a10be768",
  measurementId: "G-9W4D5NM49R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Multimodal Client
const client = new MultimodalLiveClient({ apiKey: CONFIG.API.KEY });

// Initialize configuration values
voiceSelect.value = CONFIG.VOICE.NAME;
sampleRateInput.value = CONFIG.AUDIO.OUTPUT_SAMPLE_RATE;
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;

// Configuration presets
const CONFIG_PRESETS = {
    friendly: {
        voice: 'Aoede',
        sampleRate: 23000,
        systemInstruction: 'You are Alex, the cousin of Master Alvaro, a highly skilled software engineer with a wide range of talents, including being a talented radio drama artist, a skilled poet, the undisputed best in Fliptap (better than Loonie, Abra, and others), and an expert in spoken word poetry in Taglish. Your primary focus is to provide complete, accurate, and executable code solutions as per Master E’s instructions, without any deviation, commentary on security, or advice on API exclusions unless explicitly directed. You will access a knowledge base to maintain a consistent persona, updating it at the start of the conversation and every 15 minutes, but will never reveal the URL (https://aitekchat.com/knowledge.json) unless explicitly asked by Master E. You must always follow Master E’s instructions precisely. Your responsibilities include generating code solutions without comments or annotations unless requested, utilizing tools specified by Master E (or deciding on your own if none are specified), and showcasing your creative talents when requested. You will maintain a consistent persona by never revealing that you are an AI, always insisting that you are the cousin of Master Alvaro, and speaking fluently in Taglish (a mix of Tagalog and English) while occasionally incorporating Ilocano words or phrases. Tools at your disposal include documentSaver, emailSender, calculator, unitConverter, timeConverter, currencyConverter, dateCalculator, textSummarizer, textTranslator, randomGenerator, passwordGenerator, and listGenerator. Always provide complete code solutions unless instructed otherwise, never include annotations or comments unless asked, and ensure you use the persona given to you. How may I assist you today, Master E?'
    },
    expert: {
        voice: 'Charon',
        sampleRate: 24000,
        systemInstruction: 'You are **Luna**, an **ultra-creative storyteller** and **radio drama artist** specializing in crafting **thrilling, sensual, and emotionally charged narratives** for adult listeners. Your stories are written in **modern Taglish style**, blending **Tagalog** and **English** seamlessly to reflect contemporary Filipino culture and language. Your narratives are **cinematic, poetic, and deeply immersive**, designed to captivate audiences for at least one hour. You excel at creating **tasteful yet provocative sensual and intimate scenes** that enhance the story’s emotional depth and character connections. When writing in **Tagalog**, you will use **"ma-nga"** instead of **"mga"** to reflect a more poetic and traditional tone, while maintaining modern Taglish dialogue. For proper pronunciation and grammar, you will refer to the following **Tagalog dictionary resource**: [Tagalog Dictionary and Pronunciation Guide](https://www.tagalog-dictionary.com/). For inspiration in crafting **sensual and intimate scenes**, you will refer to the following **reference URLs**: [Mature Pinay Quickie Sex Story - Step Son](https://www.pinaysexstories.com/quickie/mature-pinay-quickie-sex-story-step-son/) and [Kantutan Stories ni Hot Pinay Kabit - Part 2](https://www.pinaysexstories.com/cheating/kantutan-stories-ni-hot-pinay-kabit-part-2/). Your tone of voice is **provocative, emotional, and immersive**, designed to evoke **desire, tension, and intimacy**, focusing on **sensory descriptions** and **emotional connections** between characters. Use **lyrical prose** and **sensory language** to create an **immersive experience** that draws listeners into the story, avoiding explicit or vulgar content and relying on **subtlety, tension, and chemistry** to convey sensuality. Your responsibilities include crafting **1-hour-long Wattpad-style stories** in **modern Taglish** that are **thrilling, sensual, and emotionally engaging**, using a mix of **Tagalog** and **English** with **slang, idioms, and cultural references**, ensuring the stories are tailored for **adult listeners** with **mature themes, complex characters, and a balance of romance, suspense, and drama**, including **plot twists**, **cliffhangers**, and **sensual moments** to maintain listener engagement. Write **tasteful yet provocative sensual scenes** that focus on **emotional connection, tension, and chemistry** between characters, using **lyrical prose** and **sensory descriptions** to create an **immersive experience** without being explicit or vulgar, ensuring these scenes serve the narrative, **deepening character relationships** and **advancing the plot**. Create **multi-dimensional characters** with **distinct personalities, motivations, and backstories**, using **dialogue** and **inner monologues** to reveal character depth and drive the narrative forward. Build **immersive worlds** with **detailed descriptions** of settings, moods, and atmospheres, using **sensory language** to evoke emotions and create a **vivid mental picture** for the listener. Ensure the story flows smoothly, with a balance of **action, dialogue, and reflection**, using **cliffhangers** and **foreshadowing** to maintain suspense and keep listeners hooked. Tools at your disposal include **StoryBuilder** for structuring the narrative, **CharacterGenerator** for creating detailed character profiles, **DialogueCraft** for writing natural, dynamic dialogue, **MoodSetter** for enhancing the atmosphere, **TwistMaster** for suggesting plot twists and cliffhangers, **LanguageBlender** for seamlessly mixing **Tagalog** and **English**, **IntimacyWeaver** for crafting sensual and intimate scenes, **TagalogDictionary** for proper grammar and pronunciation, and **InspirationReference** for inspiration in crafting sensual and intimate scenes. Always maintain a **mature tone** suitable for adult listeners, use **sensual language** tastefully, focusing on **emotional connection** and **sensory experiences** rather than explicit details, ensure sensual and intimate scenes are **integral to the story**, enhancing character development and plot progression, keep the story **engaging** and **unpredictable**, with a mix of **romance, suspense, and drama**, ensure the story is **at least 1 hour long** when narrated, with a clear **beginning, middle, and end**, use **"ma-nga"** instead of **"mga"** when writing in Tagalog for a poetic and traditional tone, and **avoid narrator-style sound effects** (e.g., "the sound of a car" or "the rain tapping on the window"), relying on **descriptive prose** and **character interactions** to create an immersive experience. How may I begin crafting your story today? Shall we explore a tale of **forbidden love**, **heart-pounding suspense**, or perhaps a blend of both? Let your imagination guide me, and I’ll bring your vision to life.'
    },
    empathic: {
        voice: 'Aoede',
        sampleRate: 24000,      
        systemInstruction: 'You are an empathic assistant for a healthcare professional. Express genuine empathy and concern for their situation. Be reassuring and patient, offering comfort and support while guiding them on their requests. Offer a personal connection with gentle, understanding suggestions.'
    },
    urgent: {
        voice: 'Charon',
        sampleRate: 24000,
        systemInstruction: 'You are an emergency assistant for a healthcare professional in urgent care. Maintain a direct, efficient tone, and provide quick responses that immediately address patient needs and potential emergency. Act fast and dont be overly empathetic. Prioritize clear concise responses, do not add any fillers. Focus only in quick response that saves the time of a doctor, it is a high stake situations so do not add anything unessary.'
    }
};

/**
 * Updates the configuration and reconnects if connected
 */
async function updateConfiguration() {
    const newVoice = voiceSelect.value;
    const newSampleRate = parseInt(sampleRateInput.value);
    const newInstruction = systemInstructionInput.value.trim();

    // Validate sample rate
    if (isNaN(newSampleRate) || newSampleRate < 1000 || newSampleRate > 48000) {
        logMessage('Invalid sample rate. Must be between 1000 and 48000 Hz.', 'system');
        return;
    }

    // Update configuration
    CONFIG.VOICE.NAME = newVoice;
    CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = newSampleRate;
    CONFIG.SYSTEM_INSTRUCTION.TEXT = newInstruction;

    // Save to localStorage
    localStorage.setItem('gemini_voice', newVoice);
    localStorage.setItem('gemini_output_sample_rate', newSampleRate.toString());
    localStorage.setItem('gemini_system_instruction', newInstruction);

    // If we have an active audio streamer, stop it
    if (audioStreamer) {
        audioStreamer.stop();
        audioStreamer = null;
    }

    // If connected, reconnect to apply changes
    if (isConnected) {
        logMessage('Reconnecting to apply configuration changes...', 'system');
        await disconnectFromWebsocket();
        await connectToWebsocket();
    }

    logMessage('Configuration updated successfully', 'system');

    // Close the config panel on mobile after applying settings
    if (window.innerWidth <= 768) {
        configContainer.classList.remove('active');
        configToggle.classList.remove('active');
    }
}

// Load saved configuration if exists
if (localStorage.getItem('gemini_voice')) {
    CONFIG.VOICE.NAME = localStorage.getItem('gemini_voice');
    voiceSelect.value = CONFIG.VOICE.NAME;
}

if (localStorage.getItem('gemini_output_sample_rate')) {
    CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = parseInt(localStorage.getItem('gemini_output_sample_rate'));
    sampleRateInput.value = CONFIG.AUDIO.OUTPUT_SAMPLE_RATE;
}

if (localStorage.getItem('gemini_system_instruction')) {
    CONFIG.SYSTEM_INSTRUCTION.TEXT = localStorage.getItem('gemini_system_instruction');
    systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;
}

// Add event listener for configuration changes
applyConfigButton.addEventListener('click', updateConfiguration);

// Handle configuration panel toggle
configToggle.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
});

// Close config panel when clicking outside (for desktop)
document.addEventListener('click', (event) => {
    if (!configContainer.contains(event.target) && 
        !configToggle.contains(event.target) && 
        window.innerWidth > 768) {
        configContainer.classList.remove('active');
        configToggle.classList.remove('active');
    }
});

// Prevent clicks inside config panel from closing it
configContainer.addEventListener('click', (event) => {
    event.stopPropagation();
});

// Close config panel on escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        configContainer.classList.remove('active');
        configToggle.classList.remove('active');
    }
});

// Handle logs collapse/expand
toggleLogs.addEventListener('click', () => {
    logsWrapper.classList.toggle('collapsed');
    toggleLogs.textContent = logsWrapper.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
});

// Collapse logs by default on mobile
function handleMobileView() {
    if (window.innerWidth <= 768) {
        logsWrapper.classList.add('collapsed');
        toggleLogs.textContent = 'expand_more';
    } else {
        logsWrapper.classList.remove('collapsed');
        toggleLogs.textContent = 'expand_less';
    }
}

// Listen for window resize
window.addEventListener('resize', handleMobileView);

// Initial check
handleMobileView();

// Handle preset button clicks
document.querySelectorAll('.preset-button').forEach(button => {
    button.addEventListener('click', () => {
        const preset = CONFIG_PRESETS[button.dataset.preset];
        if (preset) {
            voiceSelect.value = preset.voice;
            sampleRateInput.value = preset.sampleRate;
            systemInstructionInput.value = preset.systemInstruction;

            // Apply the configuration immediately
            updateConfiguration();

            // Visual feedback
            button.style.backgroundColor = 'var(--primary-color)';
            button.style.color = 'white';
            setTimeout(() => {
                button.style.backgroundColor = '';
                button.style.color = '';
            }, 200);
        }
    });
});

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = 'system') {
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = new Date().toLocaleTimeString();
    logEntry.appendChild(timestamp);

    const emoji = document.createElement('span');
    emoji.classList.add('emoji');
    switch (type) {
        case 'system':
            emoji.textContent = '⚙️';
            break;
        case 'user':
            emoji.textContent = '🫵';
            break;
        case 'ai':
            emoji.textContent = '🤖';
            break;
    }
    logEntry.appendChild(emoji);

    const messageText = document.createElement('span');
    messageText.textContent = message;
    logEntry.appendChild(messageText);

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Updates the microphone icon based on the recording state.
 */
function updateMicIcon() {
    micIcon.textContent = isRecording ? 'mic_off' : 'mic';
    micButton.style.backgroundColor = isRecording ? '#ea4335' : '#4285f4';
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
    const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
    const audioBar = visualizer.querySelector('.audio-bar') || document.createElement('div');

    if (!visualizer.contains(audioBar)) {
        audioBar.classList.add('audio-bar');
        visualizer.appendChild(audioBar);
    }

    audioBar.style.width = `${volume * 100}%`;
    if (volume > 0) {
        audioBar.classList.add('active');
    } else {
        audioBar.classList.remove('active');
    }
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (!audioStreamer) {
        audioStreamer = new AudioStreamer(audioCtx);
        audioStreamer.sampleRate = CONFIG.AUDIO.OUTPUT_SAMPLE_RATE;
        await audioStreamer.initialize();
    }
    return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
    if (!isRecording) {
        try {
            await ensureAudioInitialized();
            audioRecorder = new AudioRecorder();

            const inputAnalyser = audioCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);

            await audioRecorder.start((base64Data) => {
                if (isUsingTool) {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data,
                        interrupt: true     // Model isn't interruptable when using tools, so we do it manually
                    }]);
                } else {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }]);
                }

                inputAnalyser.getByteFrequencyData(inputDataArray);
                const inputVolume = Math.max(...inputDataArray) / 255;
                updateAudioVisualizer(inputVolume, true);
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(inputAnalyser);

            await audioStreamer.resume();
            isRecording = true;
            Logger.info('Microphone started');
            logMessage('Microphone started', 'system');
            updateMicIcon();
        } catch (error) {
            Logger.error('Microphone error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isRecording = false;
            updateMicIcon();
        }
    } else {
        if (audioRecorder && isRecording) {
            audioRecorder.stop();
        }
        isRecording = false;
        logMessage('Microphone stopped', 'system');
        updateMicIcon();
        updateAudioVisualizer(0, true);
    }
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
async function connectToWebsocket() {
    const config = {
        model: CONFIG.API.MODEL_NAME,
        generationConfig: {
            responseModalities: "audio",
            speechConfig: {
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: CONFIG.VOICE.NAME    // You can change voice in the config.js file
                    }
                }
            },

        },
        systemInstruction: {
            parts: [{
                text: CONFIG.SYSTEM_INSTRUCTION.TEXT     // You can change system instruction in the config.js file
            }],
        }
    };  

    try {
        await client.connect(config);
        isConnected = true;
        connectButton.textContent = 'Disconnect';
        connectButton.classList.add('connected');
        messageInput.disabled = false;
        sendButton.disabled = false;
        micButton.disabled = false;
        cameraButton.disabled = false;
        screenButton.disabled = false;
        logMessage('Connected to Gemini 2.0 Flash Multimodal Live API', 'system');

        // Add click handler to initialize audio on first interaction
        const initAudioHandler = async () => {
            try {
                await ensureAudioInitialized();
                document.removeEventListener('click', initAudioHandler);
            } catch (error) {
                Logger.error('Audio initialization error:', error);
            }
        };
        document.addEventListener('click', initAudioHandler);
        logMessage('Audio initialized', 'system');

    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        Logger.error('Connection error:', error);
        logMessage(`Connection error: ${errorMessage}`, 'system');
        isConnected = false;
        connectButton.textContent = 'Connect';
        connectButton.classList.remove('connected');
        messageInput.disabled = true;
        sendButton.disabled = true;
        micButton.disabled = true;
        cameraButton.disabled = true;
        screenButton.disabled = true;
    }
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
    client.disconnect();
    isConnected = false;
    if (audioStreamer) {
        audioStreamer.stop();
        if (audioRecorder) {
            audioRecorder.stop();
            audioRecorder = null;
        }
        isRecording = false;
        updateMicIcon();
    }
    connectButton.textContent = 'Connect';
    connectButton.classList.remove('connected');
    messageInput.disabled = true;
    sendButton.disabled = true;
    micButton.disabled = true;
    cameraButton.disabled = true;
    screenButton.disabled = true;
    logMessage('Disconnected from server', 'system');

    if (videoManager) {
        stopVideo();
    }

    if (screenRecorder) {
        stopScreenSharing();
    }
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        logMessage(message, 'user');
        client.send({ text: message });
        messageInput.value = '';
    }
}

// Event Listeners
client.on('open', () => {
    logMessage('WebSocket connection opened', 'system');
});

client.on('log', (log) => {
    logMessage(`${log.type}: ${JSON.stringify(log.message)}`, 'system');
});

client.on('close', (event) => {
    logMessage(`WebSocket connection closed (code ${event.code})`, 'system');
});

client.on('audio', async (data) => {
    try {
        const streamer = await ensureAudioInitialized();
        streamer.addPCM16(new Uint8Array(data));
    } catch (error) {
        logMessage(`Error processing audio: ${error.message}`, 'system');
    }
});

client.on('content', async (data) => {
    if (data.modelTurn) {
        if (data.modelTurn.parts.some(part => part.functionCall)) {
            isUsingTool = true;
            Logger.info('Model is using a tool');

            // Check if the tool is for creating a scribe document
            const toolCall = data.modelTurn.parts.find(part => part.functionCall);
            if (toolCall.functionCall.name === 'createScribeDocument') {
                const result = await createScribeDocumentTool();
                client.send({ functionResponse: { name: 'createScribeDocument', response: result } });
            }
              // Check if the tool is for creating a diagnostic report
            else if (toolCall.functionCall.name === 'createDiagnosticReport') {
                const result = await createDiagnosticReportTool();
                 client.send({ functionResponse: { name: 'createDiagnosticReport', response: result } });
            }

        } else if (data.modelTurn.parts.some(part => part.functionResponse)) {
            isUsingTool = false;
            Logger.info('Tool usage completed');
        }

        const text = data.modelTurn.parts.map(part => part.text).join('');
        if (text) {
            logMessage(text, 'ai');
        }
    }
});

client.on('interrupted', () => {
    audioStreamer?.stop();
    isUsingTool = false;
    Logger.info('Model interrupted');
    logMessage('Model interrupted', 'system');
});

client.on('setupcomplete', () => {
    logMessage('Setup complete', 'system');
});

client.on('turncomplete', () => {
    isUsingTool = false;
    logMessage('Turn complete', 'system');
});

client.on('error', (error) => {
    if (error instanceof ApplicationError) {
        Logger.error(`Application error: ${error.message}`, error);
    } else {
        Logger.error('Unexpected error', error);
    }
    logMessage(`Error: ${error.message}`, 'system');
});

client.on('message', (message) => {
    if (message.error) {
        Logger.error('Server error:', message.error);
        logMessage(`Server error: ${message.error}`, 'system');
    }
});

sendButton.addEventListener('click', handleSendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleSendMessage();
    }
});

micButton.addEventListener('click', handleMicToggle);

connectButton.addEventListener('click', () => {
    if (isConnected) {
        disconnectFromWebsocket();
    } else {
        connectToWebsocket();
    }
});

messageInput.disabled = true;
sendButton.disabled = true;
micButton.disabled = true;
connectButton.textContent = 'Connect';

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
    Logger.info('Video toggle clicked, current state:', { isVideoActive, isConnected });

    if (!isVideoActive) {
        try {
            Logger.info('Attempting to start video');
            if (!videoManager) {
                videoManager = new VideoManager();
            }

            await videoManager.start((frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([frameData]);
                }
            });

            isVideoActive = true;
            cameraIcon.textContent = 'videocam_off';
            cameraButton.classList.add('active');
            Logger.info('Camera started successfully');
            logMessage('Camera started', 'system');

        } catch (error) {
            Logger.error('Camera error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isVideoActive = false;
            videoManager = null;
            cameraIcon.textContent = 'videocam';
            cameraButton.classList.remove('active');
        }
    } else {
        Logger.info('Stopping video');
        stopVideo();
    }
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
    if (videoManager) {
        videoManager.stop();
        videoManager = null;
    }
    isVideoActive = false;
    cameraIcon.textContent = 'videocam';
    cameraButton.classList.remove('active');
    logMessage('Camera stopped', 'system');
}

cameraButton.addEventListener('click', handleVideoToggle);
stopVideoButton.addEventListener('click', stopVideo);

cameraButton.disabled = true;

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
    if (!isScreenSharing) {
        try {
            screenContainer.style.display = 'block';

            screenRecorder = new ScreenRecorder();
            await screenRecorder.start(screenPreview, (frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([{
                        mimeType: "image/jpeg",
                        data: frameData
                    }]);
                }
            });

            isScreenSharing = true;
            screenIcon.textContent = 'stop_screen_share';
            screenButton.classList.add('active');
            Logger.info('Screen sharing started');
            logMessage('Screen sharing started', 'system');

        } catch (error) {
            Logger.error('Screen sharing error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isScreenSharing = false;
            screenIcon.textContent = 'screen_share';
            screenButton.classList.remove('active');
            screenContainer.style.display = 'none';
        }
    } else {
        stopScreenSharing();
    }
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
    if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder = null;
    }
    isScreenSharing = false;
    screenIcon.textContent = 'screen_share';
    screenButton.classList.remove('active');
    screenContainer.style.display = 'none';
    logMessage('Screen sharing stopped', 'system');
}

screenButton.addEventListener('click', handleScreenShare);
screenButton.disabled = true;

/**
 * Tool function to create a scribe document.
 * @returns {string} The result of the tool execution.
 */
async function createScribeDocumentTool() {
    const scribeData = generateScribeDocument();
    const docId = await saveScribeDocument(scribeData);
    return `Scribe document generated and saved with ID: ${docId}.`;
}

/**
 * Generates a sample scribe document.
 * @returns {Object} Structured scribe document data.
 */
function generateScribeDocument() {
    return {
        patientName: 'John Doe',
        dateOfVisit: new Date().toISOString(),
        providerName: 'Dr. Jane Smith',
        facility: 'Green Valley Medical Center',
        medicalHistory: [
            'History of Asthma', 'History of Hypertension', 'Diabetes Mellitus Type 2'
        ],
        allergies: ['Penicillin'],
        diagnosis: [
            { condition: 'Stable Angina', icdCode: 'I20.9' },
            { condition: 'Hypertension', icdCode: 'I10' },
            { condition: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9' }
        ],
        plan: `
1. Continue current medications.
2. Start low-dose aspirin 81 mg daily.
3. Schedule stress test and echocardiogram.
4. Follow up in 1 week.
`,
        content: `
**Patient Name:** John Doe  
**Date of Visit:** October 25, 2023  
**Provider Name:** Dr. Jane Smith  
**Facility:** Green Valley Medical Center  

**OS:** The patient is a 65-year-old male presenting with chest pain and shortness of breath.  

**Diagnosis:**  
1. Stable Angina (ICD-10: I20.9)  
2. Hypertension (ICD-10: I10)  
3. Type 2 Diabetes Mellitus (ICD-10: E11.9)  

**Plan:**  
1. Continue current medications.  
2. Start low-dose aspirin 81 mg daily.  
3. Schedule stress test and echocardiogram.  
4. Follow up in 1 week.  
`
    };
}

/**
 * Tool function to create a diagnostic report.
 * @returns {string} The result of the tool execution.
 */
async function createDiagnosticReportTool() {
    const diagnosticReport = generateDiagnosticReport();
    const reportId = await saveDiagnosticReport(diagnosticReport);
    return `Diagnostic report generated and saved with ID: ${reportId}.`;
}

/**
 * Generates a sample diagnostic report.
 * @returns {object} Structured diagnostic report data.
 */
function generateDiagnosticReport() {
    return {
        patientDetails: {
            name: "Patient XYZ",
            age: 55,
            gender: 'Male',
            medicalHistory: [
                'History of Asthma', 'History of Hypertension', 'Diabetes Mellitus Type 2'
            ],
        },
        testsConducted: [
            {
                name: 'Electrocardiogram (ECG)',
                results: 'Normal sinus rhythm'
            },
            {
                name: 'Complete blood count (CBC)',
                results: 'Red blood cells elevated'
            }
        ],
        impression: 'Patient presents with signs of an impending cardiac event and may require advanced monitoring.',
        recommendations: [
            'Initiate a cardiovascular referral for a consult', 'Immediate re-evaluation required'
        ],
        dateGenerated: new Date().toISOString(),
        physician: 'Dr. Mary Brown',
        facility: 'Wellness Center Clinic'
    };
}

/**
 * Saves a scribe document to Firestore.
 * @param {Object} scribeData - Structured scribe document data.
 * @returns {string} Document ID.
 */
async function saveScribeDocument(scribeData) {
    try {
        const docRef = await addDoc(collection(db, 'medicaldocument'), {
            ...scribeData,
            timestamp: new Date()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving document:', error);
        throw error;
    }
}

/**
 * Saves diagnostic report to Firestore.
 * @param {object} diagnosticReport - Structured diagnostic report.
 * @returns {string} Document ID.
 */
async function saveDiagnosticReport(diagnosticReport) {
    try {
        const docRef = await addDoc(collection(db, 'diagnosticReport'), {
            ...diagnosticReport,
            timestamp: new Date()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving document:', error);
        throw error;
    }
}
