import React, { useRef, useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { BiDownload, BiSearch, BiFilterAlt } from 'react-icons/bi';

// Register AG Grid Community & Enterprise modules once
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export const AgGridTable = ({
    rowData,
    columnDefs,
    loading = false,
    height = '680px',
    title = null,
    quickFilter = true,
    enableSearch = true,
    exportButtons = true,
    enableExport = true,
    enableSidebar = true,
    enableFloatingFilter = true,
    extraHeaderActions = null,
    onRowClicked = null,
    onCellDoubleClicked = null,
    rowSelection = undefined,
    gridOptions = {},
}) => {
    const gridRef = useRef(null);
    const gridContainerRef = useRef(null);

    // Normalize search & export prop aliases
    const showQuickFilter = quickFilter ?? enableSearch ?? true;
    const showExportButtons = exportButtons ?? enableExport ?? true;
    const hasSidebar = enableSidebar && gridOptions.sideBar !== false;
    const hasFloatingFilter = enableFloatingFilter && gridOptions.floatingFilter !== false;

    // Modern professional quartz theme tailored to the dashboard's palette
    const gridTheme = useMemo(() => {
        return themeQuartz.withParams({
            accentColor: '#4f46e5',
            backgroundColor: '#ffffff',
            foregroundColor: '#0f172a',
            borderColor: '#e2e8f0',
            headerBackgroundColor: '#f8fafc',
            headerTextColor: '#334155',
            headerFontWeight: 600,
            rowHoverColor: '#f1f5f9',
            selectedRowBackgroundColor: '#e0e7ff',
            fontSize: 13,
            borderRadius: 6,
            headerHeight: 44,
            floatingFiltersHeight: 40,
        });
    }, []);

    // Default enterprise column properties
    const defaultColDef = useMemo(() => {
        return {
            filter: hasFloatingFilter,
            sortable: true,
            resizable: true,
            enableRowGroup: true,
            enablePivot: true,
            enableValue: true,
            floatingFilter: hasFloatingFilter,
            minWidth: 100,
            ...(gridOptions.defaultColDef || {})
        };
    }, [hasFloatingFilter, gridOptions.defaultColDef]);

    // Export CSV
    const onExportCsv = useCallback(() => {
        if (gridRef.current?.api) {
            gridRef.current.api.exportDataAsCsv({
                fileName: `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`
            });
        }
    }, [title]);

    // Export Excel (Enterprise feature)
    const onExportExcel = useCallback(() => {
        if (gridRef.current?.api) {
            gridRef.current.api.exportDataAsExcel({
                fileName: `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`
            });
        }
    }, [title]);

    // Quick filter search
    const onQuickFilterChanged = useCallback((e) => {
        if (gridRef.current?.api) {
            gridRef.current.api.setGridOption('quickFilterText', e.target.value);
        }
    }, []);

    // Enterprise Sidebar Configuration (Columns & Filters tool panels)
    const sideBarConfig = useMemo(() => {
        if (!hasSidebar) return false;
        if (gridOptions.sideBar !== undefined) return gridOptions.sideBar;
        return {
            toolPanels: [
                {
                    id: 'columns',
                    labelDefault: 'Columns',
                    labelKey: 'columns',
                    iconKey: 'columns',
                    toolPanel: 'agColumnsToolPanel',
                    toolPanelParams: {
                        suppressRowGroups: false,
                        suppressValues: false,
                        suppressPivots: false,
                        suppressPivotMode: false,
                    }
                },
                {
                    id: 'filters',
                    labelDefault: 'Filters',
                    labelKey: 'filters',
                    iconKey: 'filter',
                    toolPanel: 'agFiltersToolPanel',
                }
            ],
            defaultToolPanel: ''
        };
    }, [hasSidebar, gridOptions.sideBar]);

    // Status bar configuration (Total rows, filtered count, aggregations)
    const statusBar = useMemo(() => {
        return {
            statusPanels: [
                { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                { statusPanel: 'agSelectedRowCountComponent' },
                { statusPanel: 'agAggregationComponent' }
            ]
        };
    }, []);

    return (
        <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            maxWidth: '100%',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Table Control Header */}
            <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: '#fafbfc'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {title && (
                        <h3 style={{
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#0f172a'
                        }}>
                            {title}
                        </h3>
                    )}
                    {showQuickFilter && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '7px 14px',
                            width: '300px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}>
                            <BiSearch size={18} color="#64748b" style={{ marginRight: '8px' }} />
                            <input
                                type="text"
                                placeholder="Search all columns..."
                                onChange={onQuickFilterChanged}
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    width: '100%',
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    color: '#0f172a'
                                }}
                            />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {extraHeaderActions}

                    {showExportButtons && (
                        <>
                            <button
                                onClick={onExportCsv}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '7px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Export to CSV"
                            >
                                <BiDownload size={14} color="#64748b" /> CSV
                            </button>
                            <button
                                onClick={onExportExcel}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#107c41',
                                    border: '1px solid #0e6b37',
                                    borderRadius: '7px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(16, 124, 65, 0.2)',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Export to Excel (Enterprise)"
                            >
                                <BiDownload size={14} /> Excel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* AG Grid React Container */}
            <div ref={gridContainerRef} style={{ height, width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                <AgGridReact
                    ref={gridRef}
                    theme={gridTheme}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    sideBar={sideBarConfig}
                    statusBar={statusBar}
                    loading={loading}
                    // pagination={true}
                    // paginationPageSize={25}
                    // paginationPageSizeSelector={[10, 25, 50, 100, 250]}
                    rowSelection={rowSelection}
                    enableRangeSelection={true}
                    animateRows={true}
                    onRowClicked={onRowClicked}
                    onCellDoubleClicked={onCellDoubleClicked}
                    {...gridOptions}
                />
            </div>
        </div>
    );
};

export default AgGridTable;

