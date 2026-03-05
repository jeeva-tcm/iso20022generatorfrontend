import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private currentTheme: 'dark' | 'light' = 'dark';

    constructor() {
        const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light';
        this.setTheme(savedTheme || 'dark');
    }

    setTheme(theme: 'dark' | 'light') {
        this.currentTheme = theme;
        localStorage.setItem('app-theme', theme);

        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    toggleTheme() {
        this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
    }

    getTheme() {
        return this.currentTheme;
    }
}
