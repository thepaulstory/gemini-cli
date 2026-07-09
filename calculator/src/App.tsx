/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import './App.css';

type Operator = '+' | '-' | '*' | '/' | null;

function calculate(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b !== 0 ? a / b : NaN;
    default:
      return b;
  }
}

export default function App() {
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setAccumulator(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(value * -1));
  };

  const inputPercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const handleOperator = (nextOp: Operator) => {
    const inputValue = parseFloat(display);

    if (accumulator !== null && operator && !waitingForOperand) {
      const result = calculate(accumulator, inputValue, operator);
      const resultStr = isNaN(result) ? 'Error' : String(result);
      setDisplay(resultStr);
      setAccumulator(isNaN(result) ? null : result);
    } else {
      setAccumulator(inputValue);
    }

    setOperator(nextOp);
    setWaitingForOperand(true);
  };

  const handleEquals = () => {
    if (accumulator === null || operator === null) return;

    const inputValue = parseFloat(display);
    const result = calculate(accumulator, inputValue, operator);
    const resultStr = isNaN(result) ? 'Error' : String(result);

    setDisplay(resultStr);
    setAccumulator(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  interface ButtonProps {
    label: string;
    onClick: () => void;
    className?: string;
  }

  function Button({ label, onClick, className = '' }: ButtonProps) {
    return (
      <button className={`calc-btn ${className}`} onClick={onClick}>
        {label}
      </button>
    );
  }

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="buttons">
        <Button label="AC" onClick={clear} className="fn" />
        <Button label="+/-" onClick={toggleSign} className="fn" />
        <Button label="%" onClick={inputPercent} className="fn" />
        <Button label="/" onClick={() => handleOperator('/')} className="op" />

        <Button label="7" onClick={() => inputDigit('7')} />
        <Button label="8" onClick={() => inputDigit('8')} />
        <Button label="9" onClick={() => inputDigit('9')} />
        <Button label="*" onClick={() => handleOperator('*')} className="op" />

        <Button label="4" onClick={() => inputDigit('4')} />
        <Button label="5" onClick={() => inputDigit('5')} />
        <Button label="6" onClick={() => inputDigit('6')} />
        <Button label="-" onClick={() => handleOperator('-')} className="op" />

        <Button label="1" onClick={() => inputDigit('1')} />
        <Button label="2" onClick={() => inputDigit('2')} />
        <Button label="3" onClick={() => inputDigit('3')} />
        <Button label="+" onClick={() => handleOperator('+')} className="op" />

        <Button label="0" onClick={() => inputDigit('0')} className="wide" />
        <Button label="." onClick={inputDecimal} />
        <Button label="=" onClick={handleEquals} className="op" />
      </div>
    </div>
  );
}
