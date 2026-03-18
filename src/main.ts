import './style.css';
import { initApp } from './app';
import { initSettings } from './settings';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initSettings();
});
