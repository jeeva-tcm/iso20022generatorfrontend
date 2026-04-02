import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface ChatMessage {
    role: 'user' | 'bot' | 'system';
    content: string;
    timestamp: Date;
    sources?: { file: string; type: string; relevance: number }[];
    processing_time_ms?: number;
    isLoading?: boolean;
}

@Component({
    selector: 'app-chatbot',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chatbot.component.html',
    styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
    @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
    @ViewChild('fileInput') private fileInput!: ElementRef;

    isOpen = false;
    isMinimized = false;
    userInput = '';
    messages: ChatMessage[] = [];
    isLoading = false;
    suggestions: string[] = [];
    stats: any = null;
    unreadCount = 0;
    hasGreeted = false;

    private apiUrl = `${environment.apiBaseUrl}/chatbot`;

    constructor(private http: HttpClient) {}

    ngOnInit() {
        this.loadSuggestions();
        this.loadStats();
    }

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.isMinimized = false;
        if (this.isOpen) {
            this.unreadCount = 0;
            if (!this.hasGreeted) {
                this.hasGreeted = true;
                this.messages.push({
                    role: 'bot',
                    content: `👋 **Welcome to the ISO 20022 Assistant!**\n\nI can help you with:\n• Message structures (pacs, camt, pain, etc.)\n• Schema fields & validation rules\n• MT-to-MX conversion questions\n• Error troubleshooting\n\nAsk me anything or try one of the suggested questions below!`,
                    timestamp: new Date()
                });
            }
        }
    }

    minimizeChat() {
        this.isMinimized = true;
    }

    closeChat() {
        this.isOpen = false;
    }

    loadSuggestions() {
        this.http.get<any>(`${this.apiUrl}/suggestions`).subscribe({
            next: (res) => this.suggestions = res.suggestions || [],
            error: () => this.suggestions = [
                'What is pacs.008?',
                'Explain IBAN validation rules',
                'What is camt.052 used for?'
            ]
        });
    }

    loadStats() {
        this.http.get<any>(`${this.apiUrl}/stats`).subscribe({
            next: (res) => this.stats = res,
            error: () => {}
        });
    }

    useSuggestion(suggestion: string) {
        this.userInput = suggestion;
        this.send();
    }

    send() {
        const question = this.userInput.trim();
        if (!question || this.isLoading) return;

        // Add user message
        this.messages.push({
            role: 'user',
            content: question,
            timestamp: new Date()
        });

        // Add loading indicator
        this.messages.push({
            role: 'bot',
            content: '',
            timestamp: new Date(),
            isLoading: true
        });

        this.userInput = '';
        this.isLoading = true;

        this.http.post<any>(`${this.apiUrl}/ask`, { question }).subscribe({
            next: (res) => {
                // Replace loading message with actual response
                const loadingIdx = this.messages.findIndex(m => m.isLoading);
                if (loadingIdx >= 0) {
                    this.messages[loadingIdx] = {
                        role: 'bot',
                        content: res.answer,
                        timestamp: new Date(),
                        sources: res.sources,
                        processing_time_ms: res.processing_time_ms,
                        isLoading: false
                    };
                }
                this.isLoading = false;
                if (!this.isOpen) this.unreadCount++;
            },
            error: (err) => {
                const loadingIdx = this.messages.findIndex(m => m.isLoading);
                if (loadingIdx >= 0) {
                    this.messages[loadingIdx] = {
                        role: 'bot',
                        content: '❌ Sorry, I encountered an error. Please make sure the backend server is running and try again.',
                        timestamp: new Date(),
                        isLoading: false
                    };
                }
                this.isLoading = false;
            }
        });
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    }

    triggerUpload() {
        this.fileInput?.nativeElement?.click();
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        this.messages.push({
            role: 'system',
            content: `📄 Uploading "${file.name}" to the knowledge base...`,
            timestamp: new Date()
        });

        this.http.post<any>(`${this.apiUrl}/upload`, formData).subscribe({
            next: (res) => {
                this.messages.push({
                    role: 'bot',
                    content: `✅ **"${res.filename}"** uploaded successfully!\n\n${res.chunks_added} knowledge chunks extracted.\nTotal knowledge base: ${res.total_chunks} chunks.\n\nYou can now ask questions about the content of this file.`,
                    timestamp: new Date()
                });
                this.loadStats();
            },
            error: (err) => {
                const detail = err.error?.detail || 'Upload failed';
                this.messages.push({
                    role: 'bot',
                    content: `❌ Upload failed: ${detail}`,
                    timestamp: new Date()
                });
            }
        });

        // Reset file input
        event.target.value = '';
    }

    rebuildIndex() {
        this.messages.push({
            role: 'system',
            content: '🔄 Rebuilding the knowledge base index...',
            timestamp: new Date()
        });

        this.http.post<any>(`${this.apiUrl}/rebuild`, {}).subscribe({
            next: (res) => {
                this.messages.push({
                    role: 'bot',
                    content: `✅ Knowledge base rebuilt! Total: ${res.total_chunks} chunks indexed.`,
                    timestamp: new Date()
                });
                this.loadStats();
            },
            error: () => {
                this.messages.push({
                    role: 'bot',
                    content: '❌ Failed to rebuild the knowledge base.',
                    timestamp: new Date()
                });
            }
        });
    }

    formatMessage(content: string): string {
        if (!content) return '';
        // Bold
        let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Code blocks
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="chat-code">$1</pre>');
        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
        // Bullet points
        formatted = formatted.replace(/^[•\-]\s+(.+)/gm, '<div class="chat-bullet">• $1</div>');
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    private scrollToBottom(): void {
        try {
            if (this.messagesContainer) {
                const el = this.messagesContainer.nativeElement;
                el.scrollTop = el.scrollHeight;
            }
        } catch (err) {}
    }
}
