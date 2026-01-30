'use client';

import { useState, useRef, useEffect } from 'react';
import { normalizeString } from '@/lib/utils';

interface Option {
    id: number | string;
    nombre: string;
}

interface AutocompleteSelectProps {
    id: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}

export default function AutocompleteSelect({
    id,
    options,
    value,
    onChange,
    placeholder = 'Buscar...',
    required = false,
    disabled = false,
}: AutocompleteSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Find the selected option's name to display
    const selectedOption = options.find(opt => opt.id.toString() === value);

    // Filter options based on search term (insensitive to case and accents)
    const filteredOptions = options.filter(opt =>
        normalizeString(opt.nombre).includes(normalizeString(searchTerm))
    );

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to selected value when closing
                setSearchTerm(selectedOption?.nombre || '');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);

    // Update search term when value changes externally
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm(selectedOption?.nombre || '');
        }
    }, [value, selectedOption, isOpen]);

    // Scroll highlighted option into view
    useEffect(() => {
        if (listRef.current && highlightedIndex >= 0) {
            const items = listRef.current.querySelectorAll('li');
            if (items[highlightedIndex]) {
                items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        setHighlightedIndex(-1);

        // If empty, clear selection
        if (e.target.value === '') {
            onChange('');
        }
    };

    const handleInputFocus = () => {
        setIsOpen(true);
        setSearchTerm(''); // Clear to show all options
    };

    const handleOptionClick = (option: Option) => {
        onChange(option.id.toString());
        setSearchTerm(option.nombre);
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
                    handleOptionClick(filteredOptions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm(selectedOption?.nombre || '');
                break;
        }
    };

    return (
        <div className="autocomplete-container" ref={containerRef}>
            <input
                ref={inputRef}
                id={id}
                type="text"
                className="form-control autocomplete-input"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            />
            <svg
                className="autocomplete-chevron"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>

            {isOpen && (
                <ul
                    ref={listRef}
                    className="autocomplete-dropdown"
                    role="listbox"
                    aria-label="Opciones de producto"
                >
                    {filteredOptions.length === 0 ? (
                        <li className="autocomplete-empty">No se encontraron resultados</li>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <li
                                key={option.id}
                                className={`autocomplete-option ${option.id.toString() === value ? 'selected' : ''
                                    } ${highlightedIndex === index ? 'highlighted' : ''}`}
                                onClick={() => handleOptionClick(option)}
                                role="option"
                                aria-selected={option.id.toString() === value}
                            >
                                {option.nombre}
                            </li>
                        ))
                    )}
                </ul>
            )}

            <style jsx>{`
                .autocomplete-container {
                    position: relative;
                    width: 100%;
                }

                .autocomplete-input {
                    padding-right: 2.5rem;
                }

                .autocomplete-chevron {
                    position: absolute;
                    right: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 1rem;
                    height: 1rem;
                    color: #6b7280;
                    pointer-events: none;
                    transition: transform 0.2s ease;
                }

                .autocomplete-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    max-height: 200px;
                    overflow-y: auto;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-top: none;
                    border-radius: 0 0 0.375rem 0.375rem;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    z-index: 100;
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .autocomplete-option {
                    padding: 0.625rem 0.875rem;
                    cursor: pointer;
                    transition: background-color 0.15s;
                    font-size: 0.95rem;
                }

                .autocomplete-option:hover,
                .autocomplete-option.highlighted {
                    background-color: #f1f5f9;
                }

                .autocomplete-option.selected {
                    background-color: #e0f2fe;
                    font-weight: 500;
                }

                .autocomplete-option.selected.highlighted {
                    background-color: #bae6fd;
                }

                .autocomplete-empty {
                    padding: 0.75rem;
                    text-align: center;
                    color: #6b7280;
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
}
