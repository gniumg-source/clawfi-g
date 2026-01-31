import { useEffect, useRef, useState } from 'react';
import { api, type CommandResult } from '../lib/data';

interface CommandEntry {
	id: string;
	command: string;
	result?: CommandResult;
	timestamp: number;
}

export default function AgentTerminal() {
	const [command, setCommand] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);
	const [executing, setExecuting] = useState(false);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const outputRef = useRef<HTMLDivElement>(null);

	// Listen for quick command events
	useEffect(() => {
		const handleQuickCmd = (e: CustomEvent<{ command: string }>) => {
			if (e.detail.command.includes('<')) {
				// Commands with placeholders - just fill the input
				setCommand(e.detail.command);
				inputRef.current?.focus();
			} else {
				// Complete commands - execute immediately
				executeCommand(e.detail.command);
			}
		};

		window.addEventListener('clawfi:quickcmd', handleQuickCmd as EventListener);
		return () => window.removeEventListener('clawfi:quickcmd', handleQuickCmd as EventListener);
	}, []);

	// Scroll to bottom when history updates
	useEffect(() => {
		if (outputRef.current) {
			outputRef.current.scrollTop = outputRef.current.scrollHeight;
		}
	}, [history]);

	const executeCommand = async (cmd: string) => {
		if (!cmd.trim() || executing) return;

		const entry: CommandEntry = {
			id: Date.now().toString(),
			command: cmd.trim(),
			timestamp: Date.now(),
		};

		setHistory((prev) => [...prev, entry]);
		setCommand('');
		setHistoryIndex(-1);
		setExecuting(true);

		try {
			const result = await api.sendCommand(cmd.trim());
			setHistory((prev) =>
				prev.map((e) => (e.id === entry.id ? { ...e, result } : e))
			);
		} catch (err) {
			setHistory((prev) =>
				prev.map((e) =>
					e.id === entry.id
						? {
								...e,
								result: {
									success: false,
									action: cmd.split(' ')[0],
									message: err instanceof Error ? err.message : 'Command failed',
								},
						  }
						: e
				)
			);
		} finally {
			setExecuting(false);
			inputRef.current?.focus();
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		executeCommand(command);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		const commandHistory = history.filter((h) => h.command);
		
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (historyIndex < commandHistory.length - 1) {
				const newIndex = historyIndex + 1;
				setHistoryIndex(newIndex);
				setCommand(commandHistory[commandHistory.length - 1 - newIndex].command);
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (historyIndex > 0) {
				const newIndex = historyIndex - 1;
				setHistoryIndex(newIndex);
				setCommand(commandHistory[commandHistory.length - 1 - newIndex].command);
			} else if (historyIndex === 0) {
				setHistoryIndex(-1);
				setCommand('');
			}
		}
	};

	return (
		<div className="bg-black">
			{/* Terminal Output */}
			<div
				ref={outputRef}
				className="h-80 overflow-y-auto p-4 font-mono text-sm"
			>
				{/* Welcome Message */}
				{history.length === 0 && (
					<div className="text-gray-500 mb-4">
						<p>ClawFi Agent Terminal v0.1.0</p>
						<p>Type `help` to see available commands.</p>
						<p className="text-primary-400/50">────────────────────────────────────</p>
					</div>
				)}

				{/* Command History */}
				{history.map((entry) => (
					<div key={entry.id} className="mb-3">
						<div className="flex items-center gap-2">
							<span className="text-primary-400">$</span>
							<span className="text-white">{entry.command}</span>
						</div>
						{entry.result ? (
							<div className={`mt-1 ml-4 ${entry.result.success ? 'text-emerald-400' : 'text-red-400'}`}>
								<div className="flex items-center gap-2">
									{entry.result.success ? (
										<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									) : (
										<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
										</svg>
									)}
									<span>{entry.result.message}</span>
								</div>
								{entry.result.data && Object.keys(entry.result.data).length > 0 && (
									<pre className="mt-2 text-gray-400 text-xs whitespace-pre-wrap overflow-hidden">
										{JSON.stringify(entry.result.data, null, 2)}
									</pre>
								)}
							</div>
						) : (
							<div className="mt-1 ml-4 text-gray-500">
								<span className="animate-pulse">Processing...</span>
							</div>
						)}
					</div>
				))}

				{/* Active input cursor indicator */}
				{executing && (
					<div className="flex items-center gap-2 text-gray-500">
						<span className="w-2 h-4 bg-primary-400 animate-pulse"></span>
					</div>
				)}
			</div>

			{/* Input Line */}
			<form onSubmit={handleSubmit} className="border-t border-gray-800">
				<div className="flex items-center px-4 py-3 gap-2">
					<span className="text-primary-400 font-mono">$</span>
					<input
						ref={inputRef}
						type="text"
						value={command}
						onChange={(e) => setCommand(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={executing}
						placeholder="Enter command..."
						className="flex-1 bg-transparent text-white font-mono text-sm outline-none placeholder-gray-600"
						autoComplete="off"
						spellCheck={false}
					/>
					<button
						type="submit"
						disabled={executing || !command.trim()}
						className="px-3 py-1 text-sm font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{executing ? (
							<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						) : (
							'Run'
						)}
					</button>
				</div>
			</form>
		</div>
	);
}


