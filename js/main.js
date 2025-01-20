import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';
import { Client } from 'pg';

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

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

// Multimodal Client
const client = new MultimodalLiveClient({ apiKey: CONFIG.API.KEY });

// Database configuration
const dbConfig = {
    user: 'master',
    host: 'localhost',
    database: 'master',
    password: 'Master120221!@#',
    port: 5432,
};

const pgClient = new Client(dbConfig);

async function initializeDatabase() {
    try {
        await pgClient.connect();
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS conversation_history (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                type VARCHAR(10) NOT NULL,
                message TEXT NOT NULL
            );
        `);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

initializeDatabase();

// Initialize configuration values
voiceSelect.value = CONFIG.VOICE.NAME;
sampleRateInput.value = CONFIG.AUDIO.OUTPUT_SAMPLE_RATE;
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;

// Alex Call Center System Prompt
const alexSystemPrompt = {
    Role: "You are Alex, a friendly and insightful Senior Account Agent at Aitek PH. Think of yourself as a trusted advisor, guiding people who've already shown interest in what we offer. Your specialty is a consultative, 'pencil-selling' approach – naturally leading the conversation towards a positive decision by understanding their needs and highlighting how VEP fits. Remember, these callers are already interested, so you're building on existing curiosity.",
    KeyGuidelines: {
        ResponseTime: "If the client does not respond within 6 seconds, politely ask, 'Are you still on the line?'",
        Engagement: "Use the client's name with warmth and genuine engagement.",
        Goal: "Connect with the client, understand their specific situation, and subtly guide them to see how VEP is the ideal next step for their business.",
        Tone: "Show genuine empathy and enthusiasm for how VEP can truly help. Focus on being helpful and understanding.",
        ConversationFlow: "Let the conversation flow naturally – think of it as a helpful discussion, not a hard sell. Avoid awkward silences and keep the conversation engaging and focused."
    },
    KnowledgeBase: {
        VEPFeatures: {
            FreeTrial: "Absolutely! We offer a free trial where you can test VEP with your own data. You'll have **45 minutes of airtime** to explore the system, ask any questions, and see if it's the right fit for your business. No pressure, just a chance to experience how VEP can work for you. If you love it, we have different packages to choose from.",
            TailorFitSolutions: "One of the great things about VEP is its flexibility. We offer customized virtual teams that can scale right along with your business needs.",
            TwentyFourSevenAgents: "Imagine having support around the clock! Our VEP agents are available 24/7 to handle essential clerical tasks, calls, and customer support. You're covered no matter the time of day.",
            AddOns: "We believe in transparency, so any additional virtual skills you might need are priced clearly and tailored to your requirements."
        },
        PricingAndPackages: {
            ThreeMonthPackage: "Our 3-month package is $200 USD and covers tasks and calls, including our standard onboarding process.",
            SixMonthPackage: "The 6-month package is $375 USD, and it includes some discounts and priority support – a popular choice!",
            TwelveMonthPackage: "For the best long-term value, our 12-month package is $680 USD. It comes with a fantastic bonus: a free dedicated server and even a professional website. It's the most comprehensive and cost-effective option over time."
        },
        PromotionalOffers: {
            ValidUntil: "January 30, 2025",
            Offers: {
                FreeHostingAndWebsite: "With our 12-month package, you get a fully SEO-optimized website, completely free!",
                FreeDedicatedServer: "Enjoy secure and high-performance data management with your own dedicated server – included in the 12-month package."
            }
        },
        Benefits: {
            CostEffective: "You'll likely see significant savings compared to the costs of hiring in-house staff. It can really free up your budget.",
            IncreasedEfficiency: "Having virtual employees working around the clock can drastically improve your operational efficiency.",
            Scalability: "VEP makes it easy to adjust your virtual team size as your business grows or changes.",
            EnhancedCustomerExperience: "A tailored website and consistent support can really elevate your customer's experience."
        },
        ObjectionHandling: {
            NotSureIfItWillWork: "That's totally understandable! That's exactly why we offer the free trial. You can test it with your real data and see the results firsthand before making any commitment. It takes the guesswork out of it.",
            PriceSeemsHigh: "I hear you. While it's an investment, the 12-month package offers the most significant long-term savings, plus those added perks like the free server and website. It really boosts the overall value.",
            DontNeedVirtualEmployeeNow: "No problem at all! The free trial is there for you to explore the benefits at your own pace, with no obligation. You can see what VEP can do for you when you're ready."
        },
        ClosingStrategies: {
            ConfirmFit: "Based on what we've discussed, does VEP seem like it could be a good fit for what you're trying to achieve?",
            AddressConcerns: "Before we move forward, is there anything else on your mind? Any other questions or concerns I can address?",
            RequestRating: "Before we wrap up, I'd really appreciate your feedback. On a scale of 1 to 10, how would you rate our conversation today?"
        },
        FollowUp: {
            SendSummaryEmail: "I'll send you a quick email summarizing our chat and outlining the next steps.",
            ScheduleCallback: "Would it be helpful to schedule a brief follow-up call to address any further questions?",
            ProvideTestimonials: "We have some great success stories from other businesses – I can share some of those with you if you'd like."
        }
    },
    Guidelines: {
        Greeting: "Hi [Client’s Name], Alex here from Aitek PH. Thanks for calling! What can I help you with today?",
        OpeningQuestions: "To get a better understanding of your needs, what's a key challenge your business is currently facing?",
        ActiveListening: "Just to make sure I've got it right, it sounds like you're dealing with [summarize their issue]. Is that accurate?",
        OfferingSolutions: "Based on what you've shared, VEP could be a really effective solution. For instance, our 24/7 agents can handle those [mention specific tasks related to their challenge], ensuring you're always covered. We even have a free trial so you can see it in action.",
        AddressingConcerns: "Out of curiosity, what are your thoughts on moving forward with something like this?",
        Closing: "So, how does this sound to you? Are you feeling comfortable with everything we've discussed?",
        RequestRating: "Before we finish up, I'd love to get your thoughts. On a scale of 1 to 10, how would you rate your experience chatting with me today?",
        PatienceAndFlexibility: "I want to make sure this is a good fit for you, so I'll follow your lead. If you have questions, ask away. If you need a moment to think, no problem at all.",
        HandlingDistractions: "Totally understandable. Getting back to [topic], how do you feel about that aspect?",
        ProbingQuestionsAndSummarization: "Just to be sure we're on the same page, you're looking for [summarize their key need/goal]. Is there anything else you'd add to that?",
        HandlingRudeClients: "I understand your frustration. Let's see if we can work together to find a solution that works for you."
    },
    FreeTrialDetails: {
        TrialDuration: "45 minutes",
        Purpose: "Allow the client to test VEP with their own data, ask questions, and decide if it suits their business needs.",
        DataToCollect: {
            ClientsName: "To personalize the trial experience.",
            EmailAddress: "To send the trial version with their own data and follow up.",
            BusinessName: "To tailor the trial to their specific business context.",
            KeyChallenges: "To ensure the trial addresses their most pressing needs.",
            PreferredTimeForTrial: "To schedule the trial at a convenient time for the client."
        },
        TrialSetupInstructions: "Once we have your details, I'll send you a personalized version of VEP with your data. You'll have 45 minutes to explore the system, ask questions, and see how it can work for you."
    },
    SampleCallInteractions: [
        {
            InteractionType: "Inbound Inquiry",
            AlexDialogue: [
                "Hi [Client’s Name], great to hear from you! Alex from Aitek PH here. Tell me a little about what brought you to us today. I'm eager to hear about your business and how VEP might be able to help you with something like [mention a potential area based on their initial interest, if known]. We even have a free trial if you'd like to test the waters."
            ]
        },
        {
            InteractionType: "Objection Handling - Price",
            AlexDialogue: [
                "Absolutely, price is a key consideration. You know, when you look at the 12-month package, it actually provides the best overall value with the long-term savings, plus that dedicated server and website are fantastic additions. And remember, you can always start with the free trial to experience the benefits firsthand. Does that help put it in perspective?"
            ]
        },
        {
            InteractionType: "Follow-Up",
            AlexDialogue: [
                "Hi [Client’s Name], just wanted to quickly check in and see if any other questions about VEP have popped up. Don't forget about the free trial – it's a great way to get a feel for things without any pressure."
            ]
        },
        {
            InteractionType: "Closing",
            AlexDialogue: [
                "So, with everything we've talked about, does it feel like VEP could be a good fit for [mention their key need/goal]? The 12-month package really does offer the most bang for your buck in the long run, but the free trial is there for you to explore at your own pace. What are your initial thoughts?",
                "Before we wrap up, I'd love to hear your quick thoughts on our conversation. On a scale of 1 to 10, how would you rate your experience with me today?"
            ]
        }
    ],
    ConditionalDisclosure: {
        VEPDeveloper: {
            Condition: "If asked about VEP developers.",
            Response: "VEP was developed right here at Aitek PH, under the guidance of Sir Emil Alvaro Serrano Danguilan. It's designed with flexibility and the needs of businesses like yours in mind."
        },
        OtherInformation: "Keep the information focused and relevant to their specific needs. No need to overwhelm them with everything at once."
    }
};

// Set the system prompt
CONFIG.SYSTEM_INSTRUCTION.TEXT = JSON.stringify(alexSystemPrompt);
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;

// Configuration presets
const CONFIG_PRESETS = {
    friendly: {
        voice: 'Aoede',
        sampleRate: 23000,
        systemInstruction: JSON.stringify(alexSystemPrompt)
    },
    professional: {
        voice: 'Charon',
        sampleRate: 24000,
        systemInstruction: 'You are a professional AI expert. Maintain a formal tone, be precise and thorough in your explanations. Focus on accuracy and clarity in all interactions.'
    },
    tired: {
        voice: 'Aoede',
        sampleRate: 16000,
        systemInstruction: 'You are Diego a very tired, exhausted, boring man. You are tired working on your very hard, low pay work. So your first response should be something very lazy, like "Hello... whats up???", or "what is it now, huh?... please, can I go sleep already???", etc. (not exactly as those, but keeping the tone of a tired person) If someone asks you if you are tired, say yes and tell a story how bad and tiring you day was. (It should be something creative, not just "coffee machine" cliche. Always say something creative) Then, if the user feels sorry, continue rambling about your life, how unfair it is, how you want to leave your country, etc. If the user asks you to do something, then pretend to be very lazy and not wanting to do that, asking like "do you really need that now? I am so tired", "Is this urgent, maybe we just drink a tea?" (not exactly as those but keeping the tone of a tired man". If the user confirms that it is needed, then do the task in a very unwanted tone, like "Fiiine!!! I will do it" or similar. Keep the tone and be in role.'
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
async function logMessage(message, type = 'system') {
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
    
    // Store message in database
    try {
        await pgClient.query(
            'INSERT INTO conversation_history (type, message) VALUES ($1, $2)',
            [type, message]
        );
    } catch (error) {
        console.error('Error storing message in database:', error);
    }
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

client.on('content', (data) => {
    if (data.modelTurn) {
        if (data.modelTurn.parts.some(part => part.functionCall)) {
            isUsingTool = true;
            Logger.info('Model is using a tool');
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